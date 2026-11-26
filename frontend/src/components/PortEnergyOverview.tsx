'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, CircleArrowUpRightExit, Database, TrendingUp, PieChart,
  Sun, Wifi, WifiOff, Zap
} from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { authService } from '../lib/Auth';
import MetricCard from './dashboard/MetricCard';
import PowerChart, { type PowerChartMetrics } from './dashboard/PowerChart';
import PVChart from './dashboard/PVChart';
import TimeSelector, {
  type TimePeriod, getTodayStartMs
} from './dashboard/TimeSelector';
import {
  EE_TAG_ID, ACTIVE_POWER_UNIT, POWER_FACTOR_UNIT, POWER_FACTOR_L1,
  POWER_FACTOR_L2, POWER_FACTOR_L3, PORT_SITE_ID, PORT_PORT_TYPE,
  BUILDING_SITE_TYPE, PV_DEVICE_ID, PV_POWER_MEAN, INTERLINK_DEVICE_ID,
  GRID_ACTIVE_POWER
} from '../types/EnergyData';
interface Meter {
  id: number;
  idSite: number;
  name: string;
  tags: number[];
  extra?: string | { friendlyName?: string } | null;
}
type SeriesRecord = [number, number, number, string, number];
interface SeriesItem {
  source?: string;
  site?: number;
  device: number;
  metric_type: number;
  records: SeriesRecord[];
}
interface SeriesResponse {
  start_dtm?: string | null;
  end_dtm?: string | null;
  series: SeriesItem[];
}
interface DashboardValues {
  totalDevices: number;
  currentTotalPower: number | string;
  averagePowerFactor: number | string;
}
interface AnalyticsValues {
  solarGeneratedToday: number;
  exportedToGridToday: number;
}
interface LoadingState {
  meters: boolean;
  power: boolean;
  powerFactor: boolean;
  solarEnergy: boolean;
}
type ErrorState = Record<keyof LoadingState, string | null>;
type EnergySample = { time: number; watts: number };
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
const ACTIVE_POWER_PHASE_METRICS: readonly number[] = [6, 7, 8];
const RECENT_METRICS_MINUTES = 120;
const MAX_ENERGY_GAP_MS = 5 * 60_000;
const REFRESH_INTERVAL_MS = 60_000;
const PV_SIGN = -1;
const EXPORT_SIGN = 1;
function getWindow(minutes: number) {
  const end = new Date();
  const start = new Date(end.getTime() - minutes * 60_000);
  return { start_dtm: start.toISOString(), end_dtm: end.toISOString() };
}
function buildSeriesPayload(minutes: number, options: {
  device?: number[]; deviceType?: string[]; metrics?: number[]; units?: number[];
}) {
  return {
    ...getWindow(minutes),
    series: [{
      sources: ['data_lake'], site: [PORT_SITE_ID], site_type: [PORT_PORT_TYPE],
      device: options.device ?? [], device_type: options.deviceType ?? [],
      metric_type: options.metrics ?? [0],
      unit: options.units ?? [ACTIVE_POWER_UNIT], field: 'default'
    }]
  };
}
function buildTodayPayload() {
  const end = new Date();
  const start = new Date(getTodayStartMs());
  return {
    start_dtm: start.toISOString(), end_dtm: end.toISOString(),
    series: [
      {
        sources: ['data_lake'], site: [PORT_SITE_ID],
        site_type: [BUILDING_SITE_TYPE], device: [PV_DEVICE_ID],
        device_type: ['meter'], metric_type: [PV_POWER_MEAN],
        unit: [0], field: 'default'
      },
      {
        sources: ['data_lake'], site: [PORT_SITE_ID],
        site_type: [BUILDING_SITE_TYPE], device: [INTERLINK_DEVICE_ID],
        device_type: ['meter'], metric_type: [GRID_ACTIVE_POWER],
        unit: [0], field: 'default'
      }
    ]
  };
}
// Use the latest coherent set of phase readings instead of interpreting absent data as zero.
function calculateCurrentTotalPower(data: SeriesResponse, eeDeviceId: number): number | null {
  const phases = new Map<number, Map<number, number>>();
  for (const series of data.series ?? []) {
    if (Number(series.device) !== eeDeviceId || !ACTIVE_POWER_PHASE_METRICS.includes(Number(series.metric_type))) continue;
    for (const record of series.records ?? []) {
      const time = new Date(record[3]).getTime(), watts = Number(record[4]);
      if (!Number.isFinite(time) || !Number.isFinite(watts)) continue;
      const minute = Math.floor(time / 60_000) * 60_000;
      if (!phases.has(minute)) phases.set(minute, new Map());
      phases.get(minute)!.set(Number(series.metric_type), watts);
    }
  }
  const minutes = [...phases.keys()].sort((a, b) => b - a);
  // Prefer the newest minute with all three phase readings.
  const complete = minutes.find(time => ACTIVE_POWER_PHASE_METRICS.every(phase => phases.get(time)!.has(phase)));
  if (complete === undefined) return null;
  return ACTIVE_POWER_PHASE_METRICS.reduce((sum, phase) => sum + phases.get(complete)!.get(phase)!, 0) / 1000;
}
function calculateAveragePowerFactor(data: SeriesResponse, eeDeviceId: number): number | null {
  const ids = [POWER_FACTOR_L1, POWER_FACTOR_L2, POWER_FACTOR_L3];
  const devices = new Map<number, Map<number, { time: number; value: number }>>();
  let newest = -Infinity;
  for (const series of data.series ?? []) {
    const id = Number(series.device), phase = Number(series.metric_type);
    if (id === eeDeviceId || !ids.includes(phase)) continue;
    if (!devices.has(id)) devices.set(id, new Map());
    for (const record of series.records ?? []) {
      const time = new Date(record[3]).getTime(), value = Number(record[4]);
      if (!Number.isFinite(time) || !Number.isFinite(value) || value <= 0) continue;
      const previous = devices.get(id)!.get(phase);
      if (!previous || time > previous.time) devices.get(id)!.set(phase, { time, value });
      newest = Math.max(newest, time);
    }
  }
  if (!Number.isFinite(newest)) return null;
  const averages: number[] = [];
  devices.forEach(phases => {
    const readings = ids.map(phase => phases.get(phase));
    if (readings.some(item => !item)) return;
    // Don't combine unrelated or very old phase readings.
    if (readings.some(item => newest - item!.time > 10 * 60_000)) return;
    averages.push(readings.reduce((sum, item) => sum + item!.value, 0) / 3);
  });
  return averages.length ? averages.reduce((sum, value) => sum + value, 0) / averages.length : null;
}
function calculateMonthlyEnergy(data: SeriesResponse, eeDeviceId: number): number {
  let totalWattMinutes = 0;
  for (const series of data.series ?? []) {
    if (Number(series.device) !== eeDeviceId || !ACTIVE_POWER_PHASE_METRICS.includes(Number(series.metric_type))) continue;
    for (const record of series.records ?? []) {
      const value = Number(record[4]);
      if (Number.isFinite(value)) totalWattMinutes += Math.max(0, value);
    }
  }
  return totalWattMinutes / 1000 / 60;
}
function extractEnergySamples(
  data: SeriesResponse, deviceId: number, metricType: number
): EnergySample[] {
  const samples: EnergySample[] = [];
  for (const series of data.series ?? []) {
    if (Number(series.device) !== deviceId ||
      Number(series.metric_type) !== metricType) continue;
    for (const record of series.records ?? []) {
      const time = new Date(record[3]).getTime();
      const watts = Number(record[4]);
      if (Number.isFinite(time) && Number.isFinite(watts)) samples.push({ time, watts });
    }
  }
  samples.sort((a, b) => a.time - b.time);
  const unique: EnergySample[] = [];
  for (const sample of samples) {
    if (unique.length && unique[unique.length - 1].time === sample.time)
      unique[unique.length - 1] = sample;
    else unique.push(sample);
  }
  return unique;
}
function calculateDailyEnergy(samples: EnergySample[], sign: number): number {
  let energy = 0;
  for (let i = 1; i < samples.length; i++) {
    const previous = samples[i - 1];
    const current = samples[i];
    const durationMs = current.time - previous.time;
    if (durationMs <= 0 || durationMs > MAX_ENERGY_GAP_MS) continue;
    const p1 = Math.max(0, previous.watts * sign);
    const p2 = Math.max(0, current.watts * sign);
    energy += ((p1 + p2) / 2) * durationMs / 3_600_000_000;
  }
  return energy;
}
export default function PortEnergyOverview() {
  const t = useTranslation();
  const router = useRouter();
  const [meters, setMeters] = useState<Meter[]>([]);
  const [values, setValues] = useState<DashboardValues>({
    totalDevices: 0, currentTotalPower: 0, averagePowerFactor: 0
  });
  const [analytics, setAnalytics] = useState<AnalyticsValues>({
    solarGeneratedToday: 0, exportedToGridToday: 0
  });
  const [loading, setLoading] = useState<LoadingState>({
    meters: true, power: true, powerFactor: true,
    solarEnergy: true
  });
  const [errors, setErrors] = useState<ErrorState>({
    meters: null, power: null, powerFactor: null,
    solarEnergy: null
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('today');
  const [powerMetrics, setPowerMetrics] = useState<PowerChartMetrics>({
    maxPower: 0, topConsumerName: 'N/A', topConsumerPercentage: 0, loading: true, error: null
  });
  const [monthlyEnergy, setMonthlyEnergy] = useState(0);
  const [monthlyEnergyLoading, setMonthlyEnergyLoading] = useState(true);
  const [monthlyEnergyError, setMonthlyEnergyError] = useState<string | null>(null);
  const handlePowerMetrics = useCallback((metrics: PowerChartMetrics) => setPowerMetrics(metrics), []);
  useEffect(() => {
    if (!meters.length) return;
    const eeMeter = meters.find(meter => meter.tags?.includes(EE_TAG_ID));
    if (!eeMeter) { setMonthlyEnergyError('Energy entrance meter not found'); setMonthlyEnergyLoading(false); return; }
    const controller = new AbortController();
    async function loadMonthlyEnergy() {
      const token = authService.getToken();
      if (!token) { authService.logout(); router.replace('/login'); return; }
      setMonthlyEnergyLoading(true);
      try {
        const payload = buildSeriesPayload(30 * 24 * 60, { device: [eeMeter!.id] });
        const response = await fetch(`${BACKEND_URL}/api/series/data_lake`, {
          method: 'POST',
          headers: { Accept: 'application/json', Authorization: `${authService.getTokenType()} ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload), signal: controller.signal, cache: 'no-store'
        });
        if (response.status === 401) { authService.logout(); router.replace('/login'); return; }
        if (!response.ok) throw new Error(`Monthly Energy API ${response.status}`);
        const data = await response.json() as SeriesResponse;
        if (controller.signal.aborted) return;
        setMonthlyEnergy(Math.round(calculateMonthlyEnergy(data, eeMeter!.id)));
        setMonthlyEnergyError(null);
      } catch (err) {
        if (!controller.signal.aborted) setMonthlyEnergyError(err instanceof Error ? err.message : 'Failed to load monthly energy');
      } finally {
        if (!controller.signal.aborted) setMonthlyEnergyLoading(false);
      }
    }
    void loadMonthlyEnergy();
    return () => controller.abort();
  }, [meters, router]);


  useEffect(() => {
    async function loadMeters() {
      const token = authService.getToken();
      const tokenType = authService.getTokenType();
      if (!token) { authService.logout(); router.replace('/login'); return; }
      try {
        const response = await fetch(`${BACKEND_URL}/api/meters`, {
          headers: {
            Accept: 'application/json',
            Authorization: `${tokenType} ${token}`
          },
          cache: 'no-store'
        });
        if (response.status === 401) {
          authService.logout(); router.replace('/login'); return;
        }
        if (!response.ok) throw new Error(`Meters API ${response.status}`);
        const data = await response.json() as Meter[];
        setMeters(data);
        setValues(current => ({ ...current, totalDevices: data.length }));
        setErrors(current => ({ ...current, meters: null }));
      } catch (err) {
        setErrors(current => ({
          ...current,
          meters: err instanceof Error ? err.message : 'Failed to load meters'
        }));
      } finally {
        setLoading(current => ({ ...current, meters: false }));
      }
    }
    void loadMeters();
  }, [router]);
  useEffect(() => {
    if (!meters.length) return;
    const eeMeter = meters.find(meter => meter.tags?.includes(EE_TAG_ID));
    if (!eeMeter) {
      setLoading(current => ({
        ...current, power: false, powerFactor: false
      }));
      return;
    }
    const controller = new AbortController();
    let inFlight = false;
    async function loadMainMetrics() {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      const token = authService.getToken();
      if (!token) { authService.logout(); router.replace('/login'); inFlight = false; return; }
      const headers = { Accept: 'application/json', Authorization: `${authService.getTokenType()} ${token}`, 'Content-Type': 'application/json' };
      const fetchMetrics = async (minutes: number) => {
        const requests = [
          buildSeriesPayload(minutes, { device: [eeMeter!.id] }),
          buildSeriesPayload(minutes, { deviceType: ['meter'], metrics: [POWER_FACTOR_L1, POWER_FACTOR_L2, POWER_FACTOR_L3], units: [POWER_FACTOR_UNIT] })
        ];
        const responses = await Promise.all(requests.map(payload => fetch(`${BACKEND_URL}/api/series/data_lake`, {
          method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal, cache: 'no-store'
        })));
        if (responses.some(response => response.status === 401)) {
          authService.logout(); router.replace('/login'); throw new Error('Unauthorized');
        }
        const [powerResponse, pfResponse] = responses;
        if (!powerResponse.ok) throw new Error(`Power API ${powerResponse.status}`);
        if (!pfResponse.ok) throw new Error(`Power Factor API ${pfResponse.status}`);
        const [powerData, pfData] = await Promise.all([
          powerResponse.json() as Promise<SeriesResponse>, pfResponse.json() as Promise<SeriesResponse>
        ]);
        return { power: calculateCurrentTotalPower(powerData, eeMeter!.id), pf: calculateAveragePowerFactor(pfData, eeMeter!.id) };
      };
      try {
        let result = await fetchMetrics(RECENT_METRICS_MINUTES);
        // Same fallback approach as PowerChart: expand search when the short window contains no readings.
        if (result.power === null || result.pf === null) {
          const fallback = await fetchMetrics(24 * 60);
          result = { power: result.power ?? fallback.power, pf: result.pf ?? fallback.pf };
        }
        if (controller.signal.aborted) return;
        setValues(current => ({ ...current,
          currentTotalPower: result.power === null ? 'N/A' : Math.round(result.power * 100) / 100,
          averagePowerFactor: result.pf === null ? 'N/A' : Math.round(result.pf * 100) / 100
        }));
        setErrors(current => ({ ...current, power: null, powerFactor: null }));
        setLastUpdated(new Date());
      } catch (err) {
        if (!controller.signal.aborted) {
          const message = err instanceof Error ? err.message : 'Failed to load main metrics';
          setErrors(current => ({ ...current, power: message, powerFactor: message }));
        }
      } finally {
        inFlight = false;
        if (!controller.signal.aborted) setLoading(current => ({ ...current, power: false, powerFactor: false }));
      }
    }
    void loadMainMetrics();
    const interval = window.setInterval(() => void loadMainMetrics(), REFRESH_INTERVAL_MS);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [meters, router]);
  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    async function loadDailySolarEnergy() {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      const token = authService.getToken();
      const tokenType = authService.getTokenType();
      if (!token) {
        inFlight = false;
        authService.logout(); router.replace('/login'); return;
      }
      setErrors(current => ({ ...current, solarEnergy: null }));
      try {
        const response = await fetch(`${BACKEND_URL}/api/series/data_lake`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `${tokenType} ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(buildTodayPayload()),
          signal: controller.signal,
          cache: 'no-store'
        });
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          authService.logout(); router.replace('/login'); return;
        }
        if (!response.ok) throw new Error(`Daily Solar Energy API ${response.status}`);
        const data = await response.json() as SeriesResponse;
        if (controller.signal.aborted) return;
        const solarSamples = extractEnergySamples(data, PV_DEVICE_ID, PV_POWER_MEAN);
        const gridSamples = extractEnergySamples(data, INTERLINK_DEVICE_ID, GRID_ACTIVE_POWER);
        setAnalytics(current => ({
          ...current,
          solarGeneratedToday: calculateDailyEnergy(solarSamples, PV_SIGN),
          exportedToGridToday: calculateDailyEnergy(gridSamples, EXPORT_SIGN)
        }));
      } catch (err) {
        if (!controller.signal.aborted) {
          setErrors(current => ({
            ...current,
            solarEnergy: err instanceof Error ? err.message : 'Failed to calculate daily energy'
          }));
        }
      } finally {
        inFlight = false;
        if (!controller.signal.aborted)
          setLoading(current => ({ ...current, solarEnergy: false }));
      }
    }
    void loadDailySolarEnergy();
    const interval = window.setInterval(
      () => void loadDailySolarEnergy(),
      REFRESH_INTERVAL_MS
    );
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [router]);
  const apiConnected = !loading.meters && !errors.meters;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
          {t.portEnergyOverview}
        </h2>
        {apiConnected ? (
          <div className="flex items-center text-green-600 dark:text-green-400">
            <Wifi className="h-4 w-4 mr-1" />
            <span className="text-sm">{t.active}</span>
          </div>
        ) : errors.meters ? (
          <div className="flex items-center text-red-600 dark:text-red-400">
            <WifiOff className="h-4 w-4 mr-1" />
            <span className="text-sm">{t.disconnected}</span>
          </div>
        ) : (
          <div className="flex items-center text-gray-500 dark:text-gray-400">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500 mr-2" />
            <span className="text-sm">{t.loadingData}</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <MetricCard title={t.totalDevicesLabel} value={values.totalDevices}
          icon={Database} variant="blue" loading={loading.meters} error={!!errors.meters} />
        <MetricCard title={t.currentTotalPowerLabel} value={values.currentTotalPower}
          unit={t.kW} icon={Zap} variant="yellow" loading={loading.power} error={!!errors.power} />
        <MetricCard title={t.averagePowerFactorLabel} value={values.averagePowerFactor}
          icon={Activity} variant="purple" loading={loading.powerFactor} error={!!errors.powerFactor} />
      </div>
      <TimeSelector
        value={timePeriod}
        onChange={setTimePeriod}
      />
      <div className="flex flex-col gap-4">
      <PowerChart timePeriod={timePeriod} onMetricsChange={handlePowerMetrics} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard title={t.maxPowerLabel} value={powerMetrics.maxPower} unit={t.kW}
          icon={TrendingUp} variant="rose" loading={powerMetrics.loading} error={!!powerMetrics.error} />
        <MetricCard title={t.topConsumerLabel} value={powerMetrics.topConsumerName}
          unit={`- ${powerMetrics.topConsumerPercentage}%`} icon={PieChart} variant="amber"
          loading={powerMetrics.loading} error={!!powerMetrics.error} />
        <MetricCard title={t.monthlyEnergyLabel} value={monthlyEnergy.toLocaleString()} unit={t.kWh}
          icon={Zap} variant="indigo" loading={monthlyEnergyLoading} error={!!monthlyEnergyError} />
      </div>
      <PVChart key={timePeriod} timePeriod={timePeriod} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <MetricCard title="Solar Generated Today"
          value={analytics.solarGeneratedToday.toFixed(2)} unit="kWh"
          icon={Sun} variant="yellow" loading={loading.solarEnergy}
          error={!!errors.solarEnergy} />
        <MetricCard title="Exported to Grid Today"
          value={analytics.exportedToGridToday.toFixed(2)} unit="kWh"
          icon={CircleArrowUpRightExit} variant="green"
          loading={loading.solarEnergy} error={!!errors.solarEnergy} />
      </div>
      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <p>{t.lastUpdated}: {lastUpdated?.toLocaleTimeString() ?? t.na}</p>
      </div>
    </div>
  );
}
