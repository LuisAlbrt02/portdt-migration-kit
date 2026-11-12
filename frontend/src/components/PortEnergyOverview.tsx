'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, CircleArrowUpRightExit, Database, PieChart, Sun, TrendingUp, Wifi, WifiOff, Zap } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { authService } from '../lib/Auth';
import MetricCard from './dashboard/MetricCard';
import PowerChart from './dashboard/PowerChart';
import PVChart from './dashboard/PVChart';
import TimeSelector, { type TimePeriod, getTimePeriodMinutes } from './dashboard/TimeSelector';
import { EE_TAG_ID, 
  ACTIVE_POWER_UNIT, 
  POWER_FACTOR_UNIT, 
  POWER_FACTOR_L1, 
  POWER_FACTOR_L2, 
  POWER_FACTOR_L3, 
  PORT_SITE_ID, 
  PORT_PORT_TYPE, 
  BUILDING_SITE_TYPE, 
  PV_DEVICE_ID, 
  PV_POWER_MEAN, 
  INTERLINK_DEVICE_ID, 
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
  currentTotalPower: number;
  averagePowerFactor: number;
}

interface AnalyticsValues {
  monthlyEnergy: number;
  maxPower: number;
  topConsumerName: string;
  topConsumerPercentage: number;
  solarGeneratedToday: number;
  exportedToGridToday: number;
}

interface LoadingState {
  meters: boolean;
  power: boolean;
  powerFactor: boolean;
  monthlyEnergy: boolean;
  periodAnalytics: boolean;
  solarEnergy: boolean;
}

type ErrorState = Record<keyof LoadingState, string | null>;

type EnergySample = {
  time: number;
  watts: number;
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
const ACTIVE_POWER_PHASE_METRICS: readonly number[] = [6, 7, 8];
const LIVE_DATA_MAX_AGE_MINUTES = 3;
const MAX_ENERGY_GAP_MS = 5 * 60_000;
const PV_SIGN = -1;
const EXPORT_SIGN = 1;

function getMeterDisplayName(meter?: Meter, deviceId?: number): string {
  if (!meter) return deviceId !== undefined ? `Device ${deviceId}` : 'Unknown device';
  if (meter.extra) {
    try {
      const extra = typeof meter.extra === 'string' ? JSON.parse(meter.extra) : meter.extra;
      if (typeof extra?.friendlyName === 'string' && extra.friendlyName.trim()) return extra.friendlyName.trim();
    } catch {}
  }
  return meter.name || `Device ${meter.id}`;
}

function getWindow(minutes: number) {
  const end = new Date(), start = new Date(end.getTime() - minutes * 60_000);
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
      metric_type: options.metrics ?? [0], unit: options.units ?? [ACTIVE_POWER_UNIT], field: 'default'
    }]
  };
}

function buildTodayPayload() {
  const end = new Date(), start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return {
    start_dtm: start.toISOString(), end_dtm: end.toISOString(),
    series: [
      { sources: ['data_lake'], site: [PORT_SITE_ID], site_type: [BUILDING_SITE_TYPE], device: [PV_DEVICE_ID], device_type: ['meter'], metric_type: [PV_POWER_MEAN], unit: [0], field: 'default' },
      { sources: ['data_lake'], site: [PORT_SITE_ID], site_type: [BUILDING_SITE_TYPE], device: [INTERLINK_DEVICE_ID], device_type: ['meter'], metric_type: [GRID_ACTIVE_POWER], unit: [0], field: 'default' }
    ]
  };
}

function getLatestValue(series: SeriesItem): number | undefined {
  if (!series.records?.length) return undefined;
  const value = Number(series.records[series.records.length - 1][4]);
  return Number.isFinite(value) ? value : undefined;
}

function calculateCurrentTotalPower(data: SeriesResponse, eeDeviceId: number): number {
  const values = (data.series ?? []).filter(s =>
    s.device === eeDeviceId && ACTIVE_POWER_PHASE_METRICS.includes(s.metric_type)
  ).map(getLatestValue).filter((value): value is number => value !== undefined);
  return values.reduce((sum, value) => sum + value, 0) / 1000;
}

function calculateAveragePowerFactor(data: SeriesResponse, eeDeviceId: number): number {
  const devices = new Map<number, Map<number, number>>();
  for (const series of data.series ?? []) {
    if (series.device === eeDeviceId || ![POWER_FACTOR_L1, POWER_FACTOR_L2, POWER_FACTOR_L3].includes(series.metric_type)) continue;
    const value = getLatestValue(series);
    if (value === undefined || value <= 0) continue;
    if (!devices.has(series.device)) devices.set(series.device, new Map());
    devices.get(series.device)!.set(series.metric_type, value);
  }
  const averages: number[] = [];
  devices.forEach(metrics => {
    const l1 = metrics.get(POWER_FACTOR_L1), l2 = metrics.get(POWER_FACTOR_L2), l3 = metrics.get(POWER_FACTOR_L3);
    if (l1 !== undefined && l2 !== undefined && l3 !== undefined) averages.push((l1 + l2 + l3) / 3);
  });
  return averages.length ? averages.reduce((sum, value) => sum + value, 0) / averages.length : 0;
}

function calculateMonthlyEnergy(data: SeriesResponse, eeDeviceId: number): number {
  let totalWattMinutes = 0;
  for (const series of data.series ?? []) {
    if (series.device !== eeDeviceId || !ACTIVE_POWER_PHASE_METRICS.includes(series.metric_type)) continue;
    for (const record of series.records ?? []) {
      const value = Number(record[4]);
      if (Number.isFinite(value)) totalWattMinutes += Math.max(0, value);
    }
  }
  return totalWattMinutes / 1000 / 60;
}

function buildDeviceMinutePower(data: SeriesResponse, eeDeviceId: number) {
  const devices = new Map<number, Map<number, number>>();
  for (const series of data.series ?? []) {
    if (series.device === eeDeviceId || !ACTIVE_POWER_PHASE_METRICS.includes(series.metric_type)) continue;
    if (!devices.has(series.device)) devices.set(series.device, new Map());
    const minuteMap = devices.get(series.device)!;
    for (const record of series.records ?? []) {
      const time = new Date(record[3]).getTime(), watts = Number(record[4]);
      if (!Number.isFinite(time) || !Number.isFinite(watts)) continue;
      const minute = Math.floor(time / 60_000) * 60_000;
      minuteMap.set(minute, (minuteMap.get(minute) ?? 0) + watts);
    }
  }
  return devices;
}

function calculatePeriodAnalytics(data: SeriesResponse, eeDeviceId: number, meters: Meter[]) {
  const devices = buildDeviceMinutePower(data, eeDeviceId);
  const portPower = new Map<number, number>(), contributions = new Map<number, number>();

  devices.forEach((minuteMap, id) => {
    let contribution = 0;
    minuteMap.forEach((watts, minute) => {
      const positive = Math.max(0, watts);
      contribution += positive;
      portPower.set(minute, (portPower.get(minute) ?? 0) + positive);
    });
    contributions.set(id, contribution);
  });

  let maxPower = 0;
  portPower.forEach(watts => { if (watts > maxPower) maxPower = watts; });

  const total = [...contributions.values()].reduce((sum, value) => sum + value, 0);
  let topId: number | null = null, topContribution = 0;
  contributions.forEach((value, id) => {
    if (value > topContribution) { topId = id; topContribution = value; }
  });

  const meter = topId === null ? undefined : meters.find(item => item.id === topId);
  return {
    maxPower: maxPower / 1000,
    topConsumerName: meter ? getMeterDisplayName(meter) : topId !== null ? `Device ${topId}` : 'N/A',
    topConsumerPercentage: total > 0 ? Math.round(topContribution / total * 100) : 0
  };
}

function extractEnergySamples(data: SeriesResponse, deviceId: number, metricType: number): EnergySample[] {
  const samples: EnergySample[] = [];
  for (const series of data.series ?? []) {
    if (Number(series.device) !== deviceId || Number(series.metric_type) !== metricType) continue;
    for (const record of series.records ?? []) {
      const time = new Date(record[3]).getTime(), watts = Number(record[4]);
      if (Number.isFinite(time) && Number.isFinite(watts)) samples.push({ time, watts });
    }
  }
  samples.sort((a, b) => a.time - b.time);
  const unique: EnergySample[] = [];
  for (const sample of samples) {
    if (unique.length && unique[unique.length - 1].time === sample.time) unique[unique.length - 1] = sample;
    else unique.push(sample);
  }
  return unique;
}

function calculateDailyEnergy(samples: EnergySample[], sign: number): number {
  let energy = 0;
  for (let i = 1; i < samples.length; i++) {
    const previous = samples[i - 1], current = samples[i];
    const durationMs = current.time - previous.time;
    if (durationMs <= 0 || durationMs > MAX_ENERGY_GAP_MS) continue;

    const p1 = Math.max(0, previous.watts * sign);
    const p2 = Math.max(0, current.watts * sign);

    energy += ((p1 + p2) / 2) * durationMs / 3_600_000_000;
  }
  return energy;
}

export default function PortEnergyOverview() {
  const t = useTranslation(), router = useRouter();
  const [meters, setMeters] = useState<Meter[]>([]);
  const [periodData, setPeriodData] = useState<SeriesResponse | null>(null);
  const [values, setValues] = useState<DashboardValues>({ totalDevices: 0, currentTotalPower: 0, averagePowerFactor: 0 });
  const [analytics, setAnalytics] = useState<AnalyticsValues>({
    monthlyEnergy: 0, maxPower: 0, topConsumerName: 'N/A',
    topConsumerPercentage: 0, solarGeneratedToday: 0, exportedToGridToday: 0
  });
  const [loading, setLoading] = useState<LoadingState>({
    meters: true, power: true, powerFactor: true, monthlyEnergy: true,
    periodAnalytics: true, solarEnergy: true
  });
  const [errors, setErrors] = useState<ErrorState>({
    meters: null, power: null, powerFactor: null, monthlyEnergy: null,
    periodAnalytics: null, solarEnergy: null
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('15min');

  useEffect(() => {
    async function loadMeters() {
      const token = authService.getToken(), tokenType = authService.getTokenType();
      if (!token) { authService.logout(); router.replace('/login'); return; }
      try {
        const response = await fetch(`${BACKEND_URL}/api/meters`, {
          headers: { Accept: 'application/json', Authorization: `${tokenType} ${token}` }, cache: 'no-store'
        });
        if (response.status === 401) { authService.logout(); router.replace('/login'); return; }
        if (!response.ok) throw new Error(`Meters API ${response.status}`);
        const data = await response.json() as Meter[];
        setMeters(data);
        setValues(current => ({ ...current, totalDevices: data.length }));
        setErrors(current => ({ ...current, meters: null }));
      } catch (err) {
        setErrors(current => ({ ...current, meters: err instanceof Error ? err.message : 'Failed to load meters' }));
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
      setLoading(current => ({ ...current, power: false, powerFactor: false, monthlyEnergy: false }));
      return;
    }
    const controller = new AbortController();

    async function loadMainMetrics() {
      const token = authService.getToken(), tokenType = authService.getTokenType();
      if (!token) { authService.logout(); router.replace('/login'); return; }
      const headers = {
        Accept: 'application/json', Authorization: `${tokenType} ${token}`,
        'Content-Type': 'application/json'
      };
      const requests = [
        buildSeriesPayload(LIVE_DATA_MAX_AGE_MINUTES, { device: [eeMeter!.id] }),
        buildSeriesPayload(LIVE_DATA_MAX_AGE_MINUTES, {
          deviceType: ['meter'], metrics: [POWER_FACTOR_L1, POWER_FACTOR_L2, POWER_FACTOR_L3], units: [POWER_FACTOR_UNIT]
        }),
        buildSeriesPayload(30 * 24 * 60, { device: [eeMeter!.id] })
      ];

      try {
        const responses = await Promise.all(requests.map(payload => fetch(`${BACKEND_URL}/api/series/data_lake`, {
          method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal
        })));
        if (controller.signal.aborted) return;
        if (responses.some(response => response.status === 401)) {
          authService.logout(); router.replace('/login'); return;
        }
        const [powerResponse, pfResponse, energyResponse] = responses;

        if (powerResponse.ok) {
          const data = await powerResponse.json() as SeriesResponse;
          setValues(current => ({
            ...current, currentTotalPower: Math.round(calculateCurrentTotalPower(data, eeMeter!.id) * 100) / 100
          }));
        } else {
          setErrors(current => ({ ...current, power: `Power API ${powerResponse.status}` }));
        }

        if (pfResponse.ok) {
          const data = await pfResponse.json() as SeriesResponse;
          setValues(current => ({
            ...current, averagePowerFactor: Math.round(calculateAveragePowerFactor(data, eeMeter!.id) * 100) / 100
          }));
        } else {
          setErrors(current => ({ ...current, powerFactor: `Power Factor API ${pfResponse.status}` }));
        }

        if (energyResponse.ok) {
          const data = await energyResponse.json() as SeriesResponse;
          setAnalytics(current => ({
            ...current, monthlyEnergy: Math.round(calculateMonthlyEnergy(data, eeMeter!.id))
          }));
        } else {
          setErrors(current => ({ ...current, monthlyEnergy: `Monthly Energy API ${energyResponse.status}` }));
        }
        if (!controller.signal.aborted) setLastUpdated(new Date());
      } catch (err) {
        if (!controller.signal.aborted) {
          const message = err instanceof Error ? err.message : 'Failed to load main metrics';
          setErrors(current => ({ ...current, power: message, powerFactor: message, monthlyEnergy: message }));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(current => ({
          ...current, power: false, powerFactor: false, monthlyEnergy: false
        }));
      }
    }
    void loadMainMetrics();
    return () => controller.abort();
  }, [meters, router]);

  useEffect(() => {
    if (!meters.length) return;
    const eeMeter = meters.find(meter => meter.tags?.includes(EE_TAG_ID));
    if (!eeMeter) {
      setLoading(current => ({ ...current, periodAnalytics: false }));
      return;
    }
    const controller = new AbortController();

    async function loadPeriodAnalytics() {
      const token = authService.getToken(), tokenType = authService.getTokenType();
      if (!token) { authService.logout(); router.replace('/login'); return; }
      setLoading(current => ({ ...current, periodAnalytics: true }));
      setErrors(current => ({ ...current, periodAnalytics: null }));

      try {
        const payload = buildSeriesPayload(getTimePeriodMinutes(timePeriod) + 5, { deviceType: ['meter'] });
        const response = await fetch(`${BACKEND_URL}/api/series/data_lake`, {
          method: 'POST',
          headers: {
            Accept: 'application/json', Authorization: `${tokenType} ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload), signal: controller.signal
        });
        if (controller.signal.aborted) return;
        if (response.status === 401) { authService.logout(); router.replace('/login'); return; }
        if (!response.ok) throw new Error(`Analytics API ${response.status}`);
        const data = await response.json() as SeriesResponse;
        if (controller.signal.aborted) return;

        setPeriodData(data);
        const result = calculatePeriodAnalytics(data, eeMeter!.id, meters);
        setAnalytics(current => ({
          ...current, maxPower: Math.round(result.maxPower * 100) / 100,
          topConsumerName: result.topConsumerName,
          topConsumerPercentage: result.topConsumerPercentage
        }));
        setLastUpdated(new Date());
      } catch (err) {
        if (controller.signal.aborted) return;
        setErrors(current => ({
          ...current, periodAnalytics: err instanceof Error ? err.message : 'Failed to load period analytics'
        }));
        setPeriodData(null);
      } finally {
        if (!controller.signal.aborted) setLoading(current => ({ ...current, periodAnalytics: false }));
      }
    }
    void loadPeriodAnalytics();
    return () => controller.abort();
  }, [meters, timePeriod, router]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDailySolarEnergy() {
      const token = authService.getToken(), tokenType = authService.getTokenType();
      if (!token) { authService.logout(); router.replace('/login'); return; }
      setLoading(current => ({ ...current, solarEnergy: true }));
      setErrors(current => ({ ...current, solarEnergy: null }));

      try {
        const response = await fetch(`${BACKEND_URL}/api/series/data_lake`, {
          method: 'POST',
          headers: {
            Accept: 'application/json', Authorization: `${tokenType} ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(buildTodayPayload()), signal: controller.signal, cache: 'no-store'
        });
        if (controller.signal.aborted) return;
        if (response.status === 401) { authService.logout(); router.replace('/login'); return; }
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
            ...current, solarEnergy: err instanceof Error ? err.message : 'Failed to calculate daily energy'
          }));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(current => ({ ...current, solarEnergy: false }));
      }
    }
    void loadDailySolarEnergy();
    return () => controller.abort();
  }, [router]);

  const apiConnected = !loading.meters && !errors.meters;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">{t.portEnergyOverview}</h2>
        {apiConnected ? (
          <div className="flex items-center text-green-600 dark:text-green-400">
            <Wifi className="h-4 w-4 mr-1" /><span className="text-sm">{t.active}</span>
          </div>
        ) : errors.meters ? (
          <div className="flex items-center text-red-600 dark:text-red-400">
            <WifiOff className="h-4 w-4 mr-1" /><span className="text-sm">{t.disconnected}</span>
          </div>
        ) : (
          <div className="flex items-center text-gray-500 dark:text-gray-400">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500 mr-2" />
            <span className="text-sm">{t.loadingData}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <MetricCard title={t.totalDevicesLabel} value={values.totalDevices} icon={Database}
          variant="blue" loading={loading.meters} error={!!errors.meters} />
        <MetricCard title={t.currentTotalPowerLabel} value={values.currentTotalPower} unit={t.kW} icon={Zap}
          variant="yellow" loading={loading.power} error={!!errors.power} />
        <MetricCard title={t.averagePowerFactorLabel} value={values.averagePowerFactor} icon={Activity}
          variant="purple" loading={loading.powerFactor} error={!!errors.powerFactor} />
      </div>

      <TimeSelector value={timePeriod} onChange={setTimePeriod} disabled={loading.periodAnalytics} />

      <PowerChart meters={meters} periodData={periodData} timePeriod={timePeriod} loading={loading.periodAnalytics} />
      <PVChart timePeriod={timePeriod} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <MetricCard title={t.monthlyEnergyLabel} value={analytics.monthlyEnergy.toLocaleString()} unit={t.kWh}
          icon={Zap} variant="indigo" loading={loading.monthlyEnergy} error={!!errors.monthlyEnergy} />
        <MetricCard title={t.maxPowerLabel} value={analytics.maxPower} unit={t.kW}
          icon={TrendingUp} variant="rose" loading={loading.periodAnalytics} error={!!errors.periodAnalytics} />
        <MetricCard title={t.topConsumerLabel} value={analytics.topConsumerName} unit={`- ${analytics.topConsumerPercentage}%`}
          icon={PieChart} variant="amber" loading={loading.periodAnalytics} error={!!errors.periodAnalytics} />
        <MetricCard title="Solar Generated Today" value={analytics.solarGeneratedToday.toFixed(2)} unit="kWh"
          icon={Sun} variant="yellow" loading={loading.solarEnergy} error={!!errors.solarEnergy} />
        <MetricCard title="Exported to Grid Today" value={analytics.exportedToGridToday.toFixed(2)} unit="kWh"
          icon={CircleArrowUpRightExit} variant="green" loading={loading.solarEnergy} error={!!errors.solarEnergy} />
      </div>

      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <p>{t.lastUpdated}: {lastUpdated ? lastUpdated.toLocaleTimeString() : t.na}</p>
      </div>
    </div>
  );
}
