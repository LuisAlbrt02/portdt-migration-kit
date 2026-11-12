
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SolarPanel } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, TimeScale, Tooltip, Legend, Filler, type ChartOptions, type ScriptableContext } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { authService } from '../../lib/Auth';
import { PORT_SITE_ID, BUILDING_SITE_TYPE, PV_DEVICE_ID, PV_POWER_MEAN, INTERLINK_DEVICE_ID, GRID_ACTIVE_POWER } from '../../types/EnergyData';
import { type TimePeriod, getTimePeriodMinutes, getChartStepMs } from './TimeSelector';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, TimeScale, Tooltip, Legend, Filler);

type SeriesRecord = [number, number, number, string, number];
type Sample = { time: number; watts: number };
interface SeriesItem { device: number; metric_type: number; records: SeriesRecord[]; }
interface SeriesResponse { series: SeriesItem[]; }
interface PVChartProps { timePeriod: TimePeriod; }

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
const PV_COLOR = '#eebb00', INTERLINK_COLOR = '#2563eb';

function buildPayload(period: TimePeriod) {
  const end = new Date(), start = new Date(end.getTime() - (getTimePeriodMinutes(period) + 5) * 60_000);
  return {
    start_dtm: start.toISOString(), end_dtm: end.toISOString(),
    series: [
      { sources: ['data_lake'], site: [PORT_SITE_ID], site_type: [BUILDING_SITE_TYPE], device: [PV_DEVICE_ID], device_type: ['meter'], metric_type: [PV_POWER_MEAN], unit: [0], field: 'default' },
      { sources: ['data_lake'], site: [PORT_SITE_ID], site_type: [BUILDING_SITE_TYPE], device: [INTERLINK_DEVICE_ID], device_type: ['meter'], metric_type: [GRID_ACTIVE_POWER], unit: [0], field: 'default' }
    ]
  };
}

// PV power records * -1 (Temporary)
function normalizePVPower(watts: number): number {
  return watts * -1;
}

function extractSamples(response: SeriesResponse, deviceId: number, metricType: number): Sample[] {
  const samples: Sample[] = [];
  for (const series of response.series ?? []) {
    if (Number(series.device) !== deviceId || Number(series.metric_type) !== metricType) continue;
    for (const record of series.records ?? []) {
      const time = new Date(record[3]).getTime(), rawWatts = Number(record[4]);
      if (!Number.isFinite(time) || !Number.isFinite(rawWatts)) continue;
      const watts = deviceId === PV_DEVICE_ID ? normalizePVPower(rawWatts) : rawWatts;
      samples.push({ time, watts });
    }
  }
  return samples.sort((a, b) => a.time - b.time);
}


function selectSamples(samples: Sample[], timestamps: number[]): (number | null)[] {
  const sorted = [...samples].sort((a, b) => a.time - b.time);
  const readings = [...new Map(sorted.map(sample => [sample.time, sample])).values()];
  const MAX_GAP_MS = 5 * 60_000;
  let index = 0;

  return timestamps.map(time => {
    while (index < readings.length && readings[index].time < time) index++;
    const next = readings[index];
    if (next?.time === time) return next.watts / 1000;

    const previous = readings[index - 1];
    if (!previous || !next) return null;

    const gap = next.time - previous.time;
    if (gap <= 0 || gap > MAX_GAP_MS) return null;

    const ratio = (time - previous.time) / gap;
    return (previous.watts + (next.watts - previous.watts) * ratio) / 1000;
  });
}


function createLineGradient(context: ScriptableContext<'line'>, rgb: string): CanvasGradient | string {
  const { chart } = context, { ctx, chartArea, scales } = chart;
  if (!chartArea || !scales.y) return `rgba(${rgb}, 0.08)`;
  const points = chart.data.datasets[context.datasetIndex]?.data ?? [];
  let sum = 0, count = 0;
  for (const point of points) if (typeof point === 'number' && Number.isFinite(point)) { sum += point; count++; }
  if (!count) return `rgba(${rgb}, 0.08)`;
  const from = scales.y.getPixelForValue(sum / count), to = scales.y.getPixelForValue(0);
  if (!Number.isFinite(from) || !Number.isFinite(to) || Math.abs(from - to) < 1) return `rgba(${rgb}, 0.08)`;
  const gradient = ctx.createLinearGradient(0, from, 0, to);
  gradient.addColorStop(0, `rgba(${rgb}, 0.16)`);
  gradient.addColorStop(1, `rgba(${rgb}, 0.01)`);
  return gradient;
}

export default function PVChart({ timePeriod }: PVChartProps) {
  const router = useRouter();
  const [responseData, setResponseData] = useState<SeriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadData() {
      setLoading(true); setError(null); setResponseData(null);
      const token = authService.getToken(), tokenType = authService.getTokenType();
      if (!token) { authService.logout(); router.replace('/login'); return; }
      try {
        const response = await fetch(`${BACKEND_URL}/api/series/data_lake`, {
          method: 'POST',
          headers: { Accept: 'application/json', Authorization: `${tokenType} ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(timePeriod)), signal: controller.signal, cache: 'no-store'
        });
        if (controller.signal.aborted) return;
        if (response.status === 401) { authService.logout(); router.replace('/login'); return; }
        if (!response.ok) throw new Error(`PV / Interlink API ${response.status}`);
        const result = await response.json() as SeriesResponse;
        if (!controller.signal.aborted) setResponseData(result);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Failed to load PV and Interlink data');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadData();
    return () => controller.abort();
  }, [timePeriod, router]);

  const chartData = useMemo(() => {
    const empty = { labels: [] as Date[], datasets: [] };
    if (!responseData?.series?.length) return empty;
    const pvSamples = extractSamples(responseData, PV_DEVICE_ID, PV_POWER_MEAN);
    const interlinkSamples = extractSamples(responseData, INTERLINK_DEVICE_ID, GRID_ACTIVE_POWER);
    let latestTime = -Infinity;
    for (const sample of pvSamples) if (sample.time > latestTime) latestTime = sample.time;
    for (const sample of interlinkSamples) if (sample.time > latestTime) latestTime = sample.time;
    if (!Number.isFinite(latestTime)) return empty;

    const stepMs = getChartStepMs(timePeriod);
    const end = Math.floor(latestTime / stepMs) * stepMs;
    const start = end - getTimePeriodMinutes(timePeriod) * 60_000;
    const timestamps: number[] = [];
    for (let time = start; time <= end; time += stepMs) timestamps.push(time);

    return {
      labels: timestamps.map(time => new Date(time)),
      datasets: [
        {
          label: 'PV', data: selectSamples(pvSamples, timestamps),
          borderColor: PV_COLOR,
          backgroundColor: (ctx: ScriptableContext<'line'>) => createLineGradient(ctx, '251, 205, 74'),
          borderWidth: 2, pointRadius: 0, pointHoverRadius: 5,
          pointHoverBackgroundColor: PV_COLOR, pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2, tension: 0, fill: 'origin' as const, spanGaps: false
        },
        {
          label: 'Interlink', data: selectSamples(interlinkSamples, timestamps),
          borderColor: INTERLINK_COLOR,
          backgroundColor: (ctx: ScriptableContext<'line'>) => createLineGradient(ctx, '37, 99, 235'),
          borderWidth: 2, pointRadius: 0, pointHoverRadius: 5,
          pointHoverBackgroundColor: INTERLINK_COLOR, pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2, tension: 0, fill: 'origin' as const, spanGaps: false
        }
      ]
    };
  }, [responseData, timePeriod]);

  const chartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true, position: 'bottom',
        labels: {
          boxWidth: 12, boxHeight: 12, padding: 20, usePointStyle: true,
          pointStyle: 'circle', font: { size: 12 },
          generateLabels: chart => ChartJS.defaults.plugins.legend.labels.generateLabels(chart).map(label => ({
            ...label, fillStyle: chart.data.datasets[label.datasetIndex]?.borderColor as string
          }))
        }
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
          label: context => {
            const value = context.parsed.y;
            return value === null ? '' : `${context.dataset.label}: ${value.toFixed(2)} kW`;
          },
          footer: items => `Total: ${items.reduce((sum, item) => sum + (item.parsed.y ?? 0), 0).toFixed(2)} kW`
        }
      },
      filler: { propagate: false },
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
        stacked: false, beginAtZero: false,
        grid: { color: 'rgba(0, 0, 0, 0.08)' },
        ticks: { callback: value => `${value} kW`, color: '#6b7280', padding: 8, font: { size: 11 } },
        border: { display: false }
      }
    },
    elements: { line: { tension: 0 } }
  }), [timePeriod]);

  const hasData = chartData.datasets.some(dataset => dataset.data.some(value => value !== null));

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-6 shadow-lg dark:border-gray-700 dark:from-gray-800 dark:to-gray-900">
      <div className="mb-4 flex items-center gap-2">
        <SolarPanel className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">PV &amp; Grid Interlink</h3>
      </div>
      <div className="h-96">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
            <span className="text-gray-500 dark:text-gray-400">Loading data...</span>
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-red-500">{error}</div>
        ) : hasData ? (
          <Line data={chartData} options={chartOptions} />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">No data available</div>
        )}
      </div>
    </div>
  );
}
