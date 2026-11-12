
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, TimeScale, Tooltip, Legend, Filler, type ChartOptions } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { useTranslation } from '../../hooks/useTranslation';
import { EE_TAG_ID } from '../../types/EnergyData';
import { type TimePeriod, getChartStepMs, getTimePeriodMinutes } from './TimeSelector';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, TimeScale, Tooltip, Legend, Filler);

export interface ChartMeter { id: number; name: string; tags: number[]; extra?: string | { friendlyName?: string } | null; }
export interface ChartSeriesItem { device: number; metric_type: number; records: [number, number, number, string, number][]; }
export interface ChartSeriesResponse { series: ChartSeriesItem[]; }
interface PowerChartProps { meters: ChartMeter[]; periodData: ChartSeriesResponse | null; timePeriod: TimePeriod; loading: boolean; }
type Sample = { time: number; watts: number };

const PHASE_METRICS = [6, 7, 8];
const MAX_GAP_MS = 5 * 60_000;
const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899',
  '#06b6d4', '#fb923c', '#84cc16', '#14b8a6', '#eab308', '#a855f7',
  '#f472b6', '#0ea5e9', '#22c55e', '#f97316', '#a3e635', '#7c3aed', '#db2777'
];

function getMeterName(meter?: ChartMeter, id?: number): string {
  if (!meter) return id !== undefined ? `Device ${id}` : 'Unknown device';
  if (meter.extra) {
    try {
      const extra = typeof meter.extra === 'string' ? JSON.parse(meter.extra) : meter.extra;
      if (typeof extra?.friendlyName === 'string' && extra.friendlyName.trim()) return extra.friendlyName.trim();
    } catch {}
  }
  return meter.name || `Device ${meter.id}`;
}

function getDeviceColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const border = COLORS[Math.abs(hash) % COLORS.length];
  return { border, bg: `${border}cc` };
}


function interpolateSamples(samples: Sample[], timestamps: number[]): (number | null)[] {
  const sorted = [...samples].sort((a, b) => a.time - b.time);
  const readings = [...new Map(sorted.map(sample => [sample.time, sample])).values()];
  const MAX_GAP_MS = 5 * 60_000, MAX_FORWARD_FILL_MS = 2 * 60_000;
  let index = 0;

  return timestamps.map(time => {
    while (index < readings.length && readings[index].time < time) index++;
    const next = readings[index];
    if (next?.time === time) return next.watts / 1000;

    const previous = readings[index - 1];
    if (!previous) return null;

    if (!next) {
      const elapsed = time - previous.time;
      return elapsed >= 0 && elapsed < MAX_FORWARD_FILL_MS ? previous.watts / 1000 : null;
    }

    const gap = next.time - previous.time;
    if (gap <= 0 || gap > MAX_GAP_MS) return null;

    return (previous.watts + (next.watts - previous.watts) * (time - previous.time) / gap) / 1000;
  });
}


export default function PowerChart({ meters, periodData, timePeriod, loading }: PowerChartProps) {
  const t = useTranslation();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const initialized = useRef(false);
  const selectRef = useRef<HTMLDetailsElement>(null);
  const eeDeviceId = useMemo(() => meters.find(m => m.tags?.includes(EE_TAG_ID))?.id, [meters]);

  const availableMeters = useMemo(() => {
    if (!periodData?.series?.length) return [];
    const ids = new Set(periodData.series.filter(s =>
      s.device !== eeDeviceId && PHASE_METRICS.includes(s.metric_type)
    ).map(s => s.device));
    return meters.filter(m => ids.has(m.id)).sort((a, b) => a.id - b.id);
  }, [periodData, meters, eeDeviceId]);

  useEffect(() => {
    if (!availableMeters.length) return;
    const ids = availableMeters.map(m => m.id);
    if (!initialized.current) {
      initialized.current = true;
      setSelectedIds(ids);
    } else {
      setSelectedIds(current => current.filter(id => ids.includes(id)));
    }
  }, [availableMeters]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) selectRef.current.open = false;
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const toggleMeter = (id: number) => setSelectedIds(current =>
    current.includes(id) ? current.filter(value => value !== id) : [...current, id]
  );

  const chartData = useMemo(() => {
    const empty = { labels: [] as Date[], datasets: [] };
    if (!periodData?.series?.length || !selectedIds.length || eeDeviceId === undefined) return empty;
    const selected = new Set(selectedIds);
    const devices = new Map<number, Map<number, Sample[]>>();
    let latestTime = -Infinity;

    for (const series of periodData.series) {
      const deviceId = Number(series.device), phase = Number(series.metric_type);
      if (deviceId === eeDeviceId || !selected.has(deviceId) || !PHASE_METRICS.includes(phase)) continue;
      if (!devices.has(deviceId)) devices.set(deviceId, new Map());
      const phases = devices.get(deviceId)!;
      if (!phases.has(phase)) phases.set(phase, []);
      for (const record of series.records ?? []) {
        const time = new Date(record[3]).getTime(), watts = Number(record[4]);
        if (!Number.isFinite(time) || !Number.isFinite(watts)) continue;
        phases.get(phase)!.push({ time, watts });
        if (time > latestTime) latestTime = time;
      }
    }
    if (!Number.isFinite(latestTime)) return empty;

    const stepMs = getChartStepMs(timePeriod);
    const end = Math.floor(latestTime / stepMs) * stepMs;
    const start = end - getTimePeriodMinutes(timePeriod) * 60_000;
    const timestamps: number[] = [];
    for (let time = start; time <= end; time += stepMs) timestamps.push(time);

    const datasets = [...devices.entries()].sort(([a], [b]) => a - b).map(([deviceId, phases]) => {
      const name = getMeterName(meters.find(m => m.id === deviceId), deviceId);
      const color = getDeviceColor(name);
      const phaseData = [...phases.values()].map(samples => interpolateSamples(samples, timestamps));
      const data = timestamps.map((_, index) => {
        const values = phaseData.map(phase => phase[index]);
        if (!values.length || values.some(value => value === null || value === undefined)) return null;
        return Math.max(0, values.reduce<number>((sum, value) => sum + (value ?? 0), 0));
      });
      return {
        label: name, data, backgroundColor: color.bg, borderColor: color.border,
        borderWidth: 1.5, fill: true, tension: 0, pointRadius: 0, pointHoverRadius: 5,
        pointHoverBackgroundColor: color.border, pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2, spanGaps: false
      };
    });

    return { labels: timestamps.map(time => new Date(time)), datasets };
  }, [periodData, selectedIds, eeDeviceId, timePeriod, meters]);

  const chartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true, position: 'bottom',
        labels: { boxWidth: 10, padding: 6, usePointStyle: true, pointStyle: 'circle', font: { size: 9 } }
      },
      tooltip: {
        enabled: true, mode: 'index', intersect: false, position: 'nearest',
        backgroundColor: 'rgba(17, 24, 39, 0.97)', titleColor: '#fff',
        bodyColor: '#e5e7eb', borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1, padding: 12, displayColors: true, boxWidth: 10,
        boxHeight: 10, usePointStyle: true, bodySpacing: 5,
        titleFont: { size: 13, weight: 'bold' },
        bodyFont: { size: 11 }, footerFont: { size: 12, weight: 'bold' },
        callbacks: {
          title: items => !items.length ? '' : new Date(items[0].parsed.x).toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit', hour12: false
          }),
          beforeBody: items => {
            const count = items.filter(item => item.parsed.y !== null && item.parsed.y >= 0.1).length;
            return count > 10 ? [`📊 ${count} active devices - Top 10 shown`] : [];
          },
          label: context => {
            const value = context.parsed.y;
            if (value === null || value < 0.1) return '';
            const all = context.chart.tooltip?.dataPoints ?? [];
            const sorted = [...all].filter(item => item.parsed.y !== null && item.parsed.y >= 0.1)
              .sort((a, b) => b.parsed.y - a.parsed.y);
            const index = sorted.findIndex(item => item.datasetIndex === context.datasetIndex);
            return index >= 10 ? '' : `${context.dataset.label}: ${value.toFixed(2)} ${t.kW}`;
          },
          afterBody: items => {
            const sorted = [...items].filter(item => item.parsed.y !== null && item.parsed.y >= 0.1)
              .sort((a, b) => b.parsed.y - a.parsed.y);
            if (sorted.length <= 10) return [];
            const others = sorted.slice(10);
            const power = others.reduce((sum, item) => sum + item.parsed.y, 0);
            return [`+ ${others.length} other devices: ${power.toFixed(2)} ${t.kW}`];
          },
          footer: items => {
            const total = items.reduce((sum, item) => sum + (item.parsed.y ?? 0), 0);
            return `Total: ${total.toFixed(2)} ${t.kW}`;
          }
        }
      },
      filler: { propagate: true },
      decimation: { enabled: false }
    },
    scales: {
      x: {
        type: 'time', stacked: false,
        time: {
          unit: timePeriod === '6hours' ? 'hour' : 'minute',
          displayFormats: { minute: 'HH:mm', hour: 'HH:mm' },
          tooltipFormat: 'HH:mm', minUnit: 'minute'
        },
        grid: { display: false },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, color: '#6b7280', font: { size: 11 } },
        border: { display: false }
      },
      y: {
        stacked: true, beginAtZero: true, suggestedMin: 0,
        grid: { color: 'rgba(0, 0, 0, 0.08)' },
        ticks: {
          callback: value => Number(value) < 0 ? '' : `${value} kW`,
          color: '#6b7280', padding: 8, font: { size: 11 }
        },
        border: { display: false }
      }
    },
    elements: { line: { tension: 0 } }
  }), [timePeriod, t.kW]);

  const selectedLabel = !selectedIds.length ? t.selectDevices :
    selectedIds.length === 1 ? getMeterName(meters.find(m => m.id === selectedIds[0]), selectedIds[0]) :
    `${selectedIds.length} ${t.devicesSelected}`;

  const periodLabels: Record<TimePeriod, string> = {
    '15min': t.last15Minutes, '30min': t.last30Minutes, '1hour': t.lastHour,
    '3hours': t.last3Hours, '6hours': t.last6Hours
  };

  const hasData = chartData.datasets.some(dataset => dataset.data.some(value => value !== null));

  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-6 shadow-lg dark:border-gray-700 dark:from-gray-800 dark:to-gray-900">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h3 className="flex items-center text-xl font-semibold text-gray-800 dark:text-gray-200">
          <Activity className="mr-2 h-8 w-8 text-blue-600 dark:text-blue-400" />
          {t.devicePowerDistribution} - {periodLabels[timePeriod]}
        </h3>
        <details ref={selectRef} className="relative">
          <summary className="flex min-w-[280px] cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 [&::-webkit-details-marker]:hidden">
            <span className="max-w-[230px] truncate">{selectedLabel}</span>
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="absolute right-0 z-50 mt-2 w-[340px] rounded-lg border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-600 dark:bg-gray-800">
            <div className="mb-2 flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700">
              <button type="button" onClick={() => setSelectedIds(availableMeters.map(m => m.id))} className="text-sm font-medium text-blue-600 hover:text-blue-700">{t.selectAll}</button>
              <button type="button" onClick={() => setSelectedIds([])} className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400">{t.clear}</button>
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {availableMeters.map(meter => (
                <label key={meter.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <input type="checkbox" checked={selectedIds.includes(meter.id)} onChange={() => toggleMeter(meter.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-200">{getMeterName(meter)}</span>
                </label>
              ))}
            </div>
          </div>
        </details>
      </div>
      <div className="h-96">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
            <span className="text-gray-500 dark:text-gray-400">{t.loadingData}</span>
          </div>
        ) : !selectedIds.length ? (
          <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">{t.noDevicesSelected}</div>
        ) : hasData ? (
          <Line data={chartData} options={chartOptions} />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">{t.noDataAvailable}</div>
        )}
      </div>
    </div>
  );
}
