'use client';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { MonitorActivity, Sun, Cable, CarFront, BatteryCharging, Truck, Zap, RefreshCw } from 'lucide-react';
import { authService } from '../../lib/Auth';
import { useTranslation } from '../../hooks/useTranslation';
import {
  PORT_SITE_ID,
  BUILDING_SITE_TYPE,
  PV_DEVICE_ID,
  PV_POWER_MEAN,
  INTERLINK_DEVICE_ID,
  GRID_ACTIVE_POWER,
  DC_BUS_VOLTAGE
} from '../../types/EnergyData';

type SeriesRecord = [number, number, number, string, number];
type Sample = { time: number; watts: number };
interface SeriesItem {
  device: number;
  metric_type: number;
  records: SeriesRecord[];
}
interface SeriesResponse {
  series: SeriesItem[];
}
interface FlowData {
  solar: number | null;
  interlink: number | null;
  generatedToday: number | null;
  dcBusVoltage: number | null;
}
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
const MAX_GAP_MS = 5 * 60_000;
const MAX_LIVE_AGE_MS = 10 * 60_000;
const PV_SIGN = -1;
const EXPORT_SIGN = 1;
const H = 470;
const Y = 238;
const X = { grid: 0.19, start: 0.265, j1: 0.45, bus: 0.61, j2: 0.77 };
const BLUE = '#93c5fd';
const YELLOW = '#eab308';
const FLOW_CSS = `
@keyframes flow-dash { to { stroke-dashoffset: -11; } }
.flow-dash { animation: flow-dash 0.9s linear infinite; }
.flow-dash.rev { animation-direction: reverse; }
@media (prefers-reduced-motion: reduce) { .flow-dash { animation: none; } }
`;
function buildSeries(start: Date, end: Date) {
  return {
    start_dtm: start.toISOString(), end_dtm: end.toISOString(),
    series: [
      { sources: ['data_lake'], site: [PORT_SITE_ID], site_type: [BUILDING_SITE_TYPE], device: [PV_DEVICE_ID], device_type: ['meter'], metric_type: [PV_POWER_MEAN], unit: [0], field: 'default' },
      { sources: ['data_lake'], site: [PORT_SITE_ID], site_type: [BUILDING_SITE_TYPE], device: [INTERLINK_DEVICE_ID], device_type: ['meter'], metric_type: [GRID_ACTIVE_POWER], unit: [0], field: 'default' }
    ]
  };
}
function buildVoltagePayload(end: Date) {
  const start = new Date(end.getTime() - 4 * 60_000);
  return {
    start_dtm: start.toISOString(),
    end_dtm: end.toISOString(),
    series: [{
      sources: ['aggregated'],
      site: [PORT_SITE_ID],
      site_type: ['port'],
      device: [INTERLINK_DEVICE_ID],
      device_type: [],
      metric_type: [DC_BUS_VOLTAGE],
      unit: [0],
      field: 'default'
    }]
  };
}
function extractSamples(data: SeriesResponse, deviceId: number, metricType: number): Sample[] {
  const samples: Sample[] = [];
  for (const series of data.series ?? []) {
    if (Number(series.device) !== deviceId || Number(series.metric_type) !== metricType) continue;
    for (const record of series.records ?? []) {
      const time = new Date(record[3]).getTime(), watts = Number(record[4]);
      if (Number.isFinite(time) && Number.isFinite(watts)) samples.push({ time, watts });
    }
  }
  samples.sort((a, b) => a.time - b.time);
  const unique: Sample[] = [];
  for (const sample of samples) {
    if (unique.length && unique[unique.length - 1].time === sample.time) unique[unique.length - 1] = sample;
    else unique.push(sample);
  }
  return unique;
}
function getLatestVoltage(data: SeriesResponse): number | null {
  const samples = extractSamples(data, INTERLINK_DEVICE_ID, DC_BUS_VOLTAGE);
  return samples.length ? samples[samples.length - 1].watts : null;
}
function getLivePower(samples: Sample[], sign: number): number | null {
  const latest = samples[samples.length - 1];
  if (!latest || Date.now() - latest.time > MAX_LIVE_AGE_MS || latest.time > Date.now() + 60_000) return null;
  return latest.watts * sign / 1000;
}
function calculateEnergy(samples: Sample[], sign: number): number {
  let total = 0;
  for (let i = 1; i < samples.length; i++) {
    const previous = samples[i - 1], current = samples[i];
    const delta = current.time - previous.time;
    if (delta <= 0 || delta > MAX_GAP_MS) continue;
    const p1 = Math.max(0, previous.watts * sign);
    const p2 = Math.max(0, current.watts * sign);
    total += (p1 + p2) / 2 * delta / 3_600_000_000;
  }
  return total;
}
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(entry.contentRect.width));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
function Arrow({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  return (
    <path d="M5 -5 L-3 0 L5 5" transform={`translate(${x} ${y}) rotate(${angle})`}
      fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  );
}
function At({ x, top, centerY, children }: { x: number; top: number; centerY?: boolean; children: ReactNode }) {
  return (
    <div className={`absolute w-[220px] -translate-x-1/2 ${centerY ? '-translate-y-1/2' : ''}`} style={{ left: x, top }}>
      {children}
    </div>
  );
}
function FlowItem({ icon: Icon, title, power, status, description, color = 'slate' }: {
  icon: typeof Sun;
  title: string;
  power: number | null;
  status: string;
  description: string;
  color?: 'yellow' | 'blue' | 'green' | 'slate';
}) {
  const colors = {
    yellow: 'text-yellow-600 dark:text-yellow-400',
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    slate: 'text-gray-400 dark:text-gray-500'
  };
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <Icon className={`mb-2 h-7 w-7 ${colors[color]}`} strokeWidth={1.7} />
      <h4 className="text-xl font-semibold text-gray-800 dark:text-gray-200">{title}</h4>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
          {power === null ? '—' : Math.abs(power).toFixed(1)}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">kW</span>
      </div>
      <span className={`text-base ${power === null ? 'text-gray-400 dark:text-gray-500' : colors[color]}`}>{status}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{description}</span>
    </div>
  );
}
export default function PowerFlowDiagram() {
  const t = useTranslation();
  const router = useRouter();
  const [data, setData] = useState<FlowData>({ solar: null, interlink: null, generatedToday: null, dcBusVoltage: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [boxRef, W] = useWidth<HTMLDivElement>();
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    async function loadData() {
      if (busy) return;
      busy = true;
      const token = authService.getToken(), tokenType = authService.getTokenType();
      if (!token) { authService.logout(); router.replace('/login'); busy = false; return; }
      try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const liveStart = new Date(now.getTime() - 15 * 60_000);
        const headers = { Accept: 'application/json', Authorization: `${tokenType} ${token}`, 'Content-Type': 'application/json' };
        const requests = [buildSeries(liveStart, now), buildSeries(today, now), buildVoltagePayload(now)];
        const responses = await Promise.all(requests.map(payload => fetch(`${BACKEND_URL}/api/series/data_lake`, {
          method: 'POST', headers, body: JSON.stringify(payload), cache: 'no-store', signal: controller.signal
        })));
        if (controller.signal.aborted) return;
        if (responses.some(response => response.status === 401)) { authService.logout(); router.replace('/login'); return; }
        if (responses.some(response => !response.ok)) throw new Error('Unable to load power flow data');
        const [live, daily, voltage] = await Promise.all(responses.map(response => response.json() as Promise<SeriesResponse>));
        if (controller.signal.aborted) return;
        const pvLive = extractSamples(live, PV_DEVICE_ID, PV_POWER_MEAN);
        const gridLive = extractSamples(live, INTERLINK_DEVICE_ID, GRID_ACTIVE_POWER);
        const pvDaily = extractSamples(daily, PV_DEVICE_ID, PV_POWER_MEAN);
        setData({
          solar: getLivePower(pvLive, PV_SIGN),
          interlink: getLivePower(gridLive, EXPORT_SIGN),
          generatedToday: calculateEnergy(pvDaily, PV_SIGN),
          dcBusVoltage: getLatestVoltage(voltage)
        });
        setUpdatedAt(new Date()); setError(null);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Power flow unavailable');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
        busy = false;
      }
    }
    void loadData();
    const interval = window.setInterval(() => void loadData(), 60_000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [router]);
  const gridStatus = data.interlink === null ? t.powerFlowDataUnavailable :
    data.interlink > 0 ? t.powerFlowExporting :
    data.interlink < 0 ? t.powerFlowImporting : t.powerFlowNoExchange;
  const solarStatus = data.solar === null ? t.powerFlowDataUnavailable :
    data.solar > 0 ? t.powerFlowGenerating : t.powerFlowIdle;
  const solarDescription = data.generatedToday === null ? t.powerFlowDailyUnavailable :
    `${data.generatedToday.toFixed(1)} kWh ${t.powerFlowGeneratedToday}`;
  const gridActive = data.interlink !== null && data.interlink !== 0;
  const gridExport = data.interlink !== null && data.interlink > 0;
  const solarActive = data.solar !== null && data.solar > 0;
  const px = (f: number) => f * W;
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 shadow-lg dark:border-gray-700 dark:from-gray-800 dark:to-gray-900">
      <div className="px-6 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center text-2xl font-semibold text-gray-800 dark:text-gray-200">
              <MonitorActivity className="mr-2 h-8 w-8 text-blue-600 dark:text-blue-400" />
              {t.powerFlowTitle}
            </h3>
            <p className="mt-2 max-w-xl text-base leading-relaxed text-gray-500 dark:text-gray-400">
              {t.powerFlowDescription}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? t.powerFlowLoading : updatedAt ? `${t.powerFlowUpdated} ${updatedAt.toLocaleTimeString('en-GB')}` : t.powerFlowAwaitingData}
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-red-500">{t.powerFlowUnavailable}</p>}
      </div>
      <div ref={boxRef} className="relative hidden h-[470px] min-w-0 md:block">
        <style>{FLOW_CSS}</style>
        {W > 0 && (
          <svg className="pointer-events-none absolute inset-0 text-gray-400 dark:text-gray-500"
            width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            <line x1={px(X.j1)} x2={px(X.j2)} y1={Y} y2={Y}
              stroke="currentColor" strokeOpacity={0.7} strokeWidth={3} />
            <line x1={px(X.j1)} x2={px(X.start)} y1={Y} y2={Y}
              stroke={gridActive ? BLUE : 'currentColor'} strokeWidth={1.5}
              strokeOpacity={gridActive ? 1 : 0.7}
              strokeDasharray={gridActive ? '6 5' : '5 5'}
              className={gridActive ? `flow-dash ${gridExport ? '' : 'rev'}` : ''} />
            {gridActive && <Arrow x={(px(X.j1) + px(X.start)) / 2} y={Y} angle={gridExport ? 0 : 180} color={BLUE} />}
            <line x1={px(X.j1)} x2={px(X.j1)} y1={191} y2={Y}
              stroke={solarActive ? YELLOW : 'currentColor'} strokeWidth={1.5}
              strokeOpacity={solarActive ? 1 : 0.7}
              strokeDasharray={solarActive ? '6 5' : '5 5'}
              className={solarActive ? 'flow-dash' : ''} />
            {solarActive && <Arrow x={px(X.j1)} y={216} angle={-90} color={YELLOW} />}
            <g stroke="currentColor" strokeWidth={1.5} strokeDasharray="5 5" strokeOpacity={0.7}>
              <line x1={px(X.j1)} x2={px(X.j1)} y1={Y} y2={294} />
              <line x1={px(X.j2)} x2={px(X.j2)} y1={193} y2={Y} />
              <line x1={px(X.j2)} x2={px(X.j2)} y1={Y} y2={284} />
            </g>
            <circle cx={px(X.j1)} cy={Y} r={3.5} fill="currentColor" />
            <circle cx={px(X.j2)} cy={Y} r={3.5} fill="currentColor" />
          </svg>
        )}
        {W > 0 && (
          <>
            <At x={px(X.grid)} top={Y} centerY>
              <FlowItem icon={Cable} title={t.powerFlowGridInterconnection} power={data.interlink}
                status={gridStatus} description={t.powerFlowACInterlink} color="blue" />
            </At>
            <At x={px(X.j1)} top={28}>
              <FlowItem icon={Sun} title={t.powerFlowSolarGeneration} power={data.solar}
                status={solarStatus} description={solarDescription} color="yellow" />
            </At>
            <At x={px(X.j2)} top={28}>
              <FlowItem icon={CarFront} title={t.powerFlowEVCharging} power={null}
                status={t.powerFlowLiveUnavailable} description={t.powerFlowCompletedSessions} />
            </At>
            <At x={px(X.j1)} top={290}>
              <FlowItem icon={BatteryCharging} title={t.powerFlowBatteryStorage} power={null}
                status={t.powerFlowDataUnavailable} description={t.powerFlowStorageSystem} color="green" />
            </At>
            <At x={px(X.j2)} top={290}>
              <FlowItem icon={Truck} title={t.powerFlowForklift} power={null}
                status={t.powerFlowDataUnavailable} description={`— kWh ${t.powerFlowThisSession}`} />
            </At>
            <div className="absolute flex h-[126px] w-[126px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-gray-300 bg-gray-50 text-center dark:border-gray-600 dark:bg-gray-800"
              style={{ left: px(X.bus), top: Y }}>
              <Zap className="mb-1 h-6 w-6 text-blue-600 dark:text-blue-400" />
              <span className="text-base text-gray-500 dark:text-gray-400">{t.powerFlowDCBus}</span>
              <span className="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                {data.dcBusVoltage === null ? '—' : data.dcBusVoltage.toFixed(1)} <span className="text-base text-gray-500 dark:text-gray-400">V</span>
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{t.powerFlowACInterlink}</span>
            </div>
          </>
        )}
      </div>
      <div className="grid grid-cols-1 gap-6 px-6 py-8 sm:grid-cols-2 md:hidden">
        <FlowItem icon={Sun} title={t.powerFlowSolarGeneration} power={data.solar}
          status={solarStatus} description={solarDescription} color="yellow" />
        <FlowItem icon={Cable} title={t.powerFlowGridInterconnection} power={data.interlink}
          status={gridStatus} description={t.powerFlowACInterlink} color="blue" />
        <FlowItem icon={CarFront} title={t.powerFlowEVCharging} power={null}
          status={t.powerFlowLiveUnavailable} description={t.powerFlowCompletedSessions} />
        <FlowItem icon={BatteryCharging} title={t.powerFlowBatteryStorage} power={null}
          status={t.powerFlowDataUnavailable} description={t.powerFlowStorageSystem} color="green" />
        <FlowItem icon={Truck} title={t.powerFlowForklift} power={null}
          status={t.powerFlowDataUnavailable} description={`— kWh ${t.powerFlowThisSession}`} />
        <div className="flex flex-col items-center justify-center gap-1 text-gray-500 dark:text-gray-400">
          <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold">{t.powerFlowDCBus}</span>
          <span className="text-lg">{data.dcBusVoltage === null ? '—' : data.dcBusVoltage.toFixed(1)} V</span>
          <span className="text-xs">{t.powerFlowACInterlink}</span>
        </div>
      </div>
    </section>
  );
}
