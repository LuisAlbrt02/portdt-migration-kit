'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Clock, Database, PieChart, TrendingUp, Wifi, WifiOff, Zap } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale,
  Filler,
  type ChartOptions,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { useTranslation } from '../hooks/useTranslation';
import { authService } from '../lib/Auth';
import MetricCard from './dashboard/MetricCard';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, TimeScale, Filler);

type TimePeriod = '15min' | '30min' | '1hour' | '3hours' | '6hours';

interface Meter {
  id: number;
  idSite: number;
  name: string;
  tags: number[];
  extra?: string | { friendlyName?: string } | null;
}

type SeriesRecord = [number, number, number, string, number];

interface SeriesItem {
  source: string;
  site: number;
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
}

interface LoadingState {
  meters: boolean;
  power: boolean;
  powerFactor: boolean;
  monthlyEnergy: boolean;
  periodAnalytics: boolean;
}

interface ErrorState {
  meters: string | null;
  power: string | null;
  powerFactor: string | null;
  monthlyEnergy: string | null;
  periodAnalytics: string | null;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
const EE_TAG_ID = 1;
const ACTIVE_POWER_UNIT = 12;
const POWER_FACTOR_UNIT = 15;
const POWER_FACTOR_L1 = 19;
const POWER_FACTOR_L2 = 20;
const POWER_FACTOR_L3 = 21;
const LIVE_DATA_MAX_AGE_MINUTES = 3;

function getMeterDisplayName(meter?: Meter, deviceId?: number): string {
  if (!meter) return deviceId !== undefined ? `Device ${deviceId}` : 'Unknown device';

  if (meter.extra) {
    try {
      const extra = typeof meter.extra === 'string' ? JSON.parse(meter.extra) : meter.extra;
      if (typeof extra?.friendlyName === 'string' && extra.friendlyName.trim()) return extra.friendlyName.trim();
    } catch {
      console.warn(`Could not parse extra for meter ${meter.id}`);
    }
  }

  return meter.name || `Device ${meter.id}`;
}

function getTimePeriodMinutes(period: TimePeriod): number {
  switch (period) {
    case '15min': return 15;
    case '30min': return 30;
    case '1hour': return 60;
    case '3hours': return 180;
    case '6hours': return 360;
  }
}

function getWindow(minutes: number) {
  const end = new Date();
  const start = new Date(end.getTime() - minutes * 60 * 1000);
  return { start_dtm: start.toISOString(), end_dtm: end.toISOString() };
}

function getLiveWindow() {
  return getWindow(LIVE_DATA_MAX_AGE_MINUTES);
}

function getMonthlyWindow() {
  return getWindow(30 * 24 * 60);
}

function buildPowerPayload(deviceId: number, siteId: number) {
  const { start_dtm, end_dtm } = getLiveWindow();

  return {
    start_dtm,
    end_dtm,
    series: [{
      sources: ['data_lake'],
      site: [siteId],
      site_type: ['port'],
      device: [deviceId],
      device_type: [],
      metric_type: [0],
      unit: [ACTIVE_POWER_UNIT],
      field: 'default',
    }],
  };
}

function buildPowerFactorPayload(siteId: number) {
  const { start_dtm, end_dtm } = getLiveWindow();

  return {
    start_dtm,
    end_dtm,
    series: [{
      sources: ['data_lake'],
      site: [siteId],
      site_type: ['port'],
      device: [],
      device_type: ['meter'],
      metric_type: [POWER_FACTOR_L1, POWER_FACTOR_L2, POWER_FACTOR_L3],
      unit: [POWER_FACTOR_UNIT],
      field: 'default',
    }],
  };
}

function buildMonthlyEnergyPayload(deviceId: number, siteId: number) {
  const { start_dtm, end_dtm } = getMonthlyWindow();

  return {
    start_dtm,
    end_dtm,
    series: [{
      sources: ['data_lake'],
      site: [siteId],
      site_type: ['port'],
      device: [deviceId],
      device_type: [],
      metric_type: [0],
      unit: [ACTIVE_POWER_UNIT],
      field: 'default',
    }],
  };
}

function buildPeriodAnalyticsPayload(siteId: number, period: TimePeriod) {
  const { start_dtm, end_dtm } = getWindow(getTimePeriodMinutes(period));

  return {
    start_dtm,
    end_dtm,
    series: [{
      sources: ['data_lake'],
      site: [siteId],
      site_type: ['port'],
      device: [],
      device_type: ['meter'],
      metric_type: [0],
      unit: [ACTIVE_POWER_UNIT],
      field: 'default',
    }],
  };
}

function getLatestValue(series: SeriesItem): number | undefined {
  if (!series.records?.length) return undefined;
  const value = series.records[series.records.length - 1][4];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function calculateCurrentTotalPower(data: SeriesResponse, eeDeviceId: number): number {
  if (!Array.isArray(data.series)) return 0;

  const values = data.series
    .filter(series => series.device === eeDeviceId && [6, 7, 8].includes(series.metric_type))
    .map(getLatestValue)
    .filter((value): value is number => value !== undefined);

  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / 1000;
}

function calculateAveragePowerFactor(data: SeriesResponse, eeDeviceId: number): number {
  if (!Array.isArray(data.series)) return 0;

  const devicePowerFactors = new Map<number, Map<number, number>>();

  data.series.forEach(series => {
    if (series.device === eeDeviceId) return;
    if (![POWER_FACTOR_L1, POWER_FACTOR_L2, POWER_FACTOR_L3].includes(series.metric_type)) return;

    const value = getLatestValue(series);
    if (value === undefined || value <= 0) return;

    let deviceValues = devicePowerFactors.get(series.device);

    if (!deviceValues) {
      deviceValues = new Map<number, number>();
      devicePowerFactors.set(series.device, deviceValues);
    }

    deviceValues.set(series.metric_type, value);
  });

  const deviceAverages: number[] = [];

  devicePowerFactors.forEach(metrics => {
    const l1 = metrics.get(POWER_FACTOR_L1);
    const l2 = metrics.get(POWER_FACTOR_L2);
    const l3 = metrics.get(POWER_FACTOR_L3);

    if (l1 === undefined || l2 === undefined || l3 === undefined) return;
    deviceAverages.push((l1 + l2 + l3) / 3);
  });

  if (!deviceAverages.length) return 0;
  return deviceAverages.reduce((sum, value) => sum + value, 0) / deviceAverages.length;
}

function calculateMonthlyEnergy(data: SeriesResponse, eeDeviceId: number): number {
  if (!Array.isArray(data.series)) return 0;

  let totalWattMinutes = 0;

  data.series
    .filter(series => series.device === eeDeviceId && [6, 7, 8].includes(series.metric_type))
    .forEach(series => {
      series.records.forEach(record => {
        const value = record[4];
        if (typeof value === 'number' && Number.isFinite(value)) totalWattMinutes += Math.max(0, value);
      });
    });

  return totalWattMinutes / 1000 / 60;
}

function buildDeviceMinutePower(data: SeriesResponse, eeDeviceId: number) {
  const result = new Map<number, Map<number, number>>();
  if (!Array.isArray(data.series)) return result;

  data.series.forEach(series => {
    if (series.device === eeDeviceId) return;
    if (![6, 7, 8].includes(series.metric_type)) return;

    let deviceMap = result.get(series.device);

    if (!deviceMap) {
      deviceMap = new Map<number, number>();
      result.set(series.device, deviceMap);
    }

    series.records.forEach(record => {
      const timestamp = new Date(record[3]);
      timestamp.setSeconds(0, 0);

      const minute = timestamp.getTime();
      const value = record[4];

      if (typeof value !== 'number' || !Number.isFinite(value)) return;
      deviceMap!.set(minute, (deviceMap!.get(minute) || 0) + value);
    });
  });

  return result;
}

function calculatePeriodAnalytics(data: SeriesResponse, eeDeviceId: number, meters: Meter[]) {
  const deviceMinutePower = buildDeviceMinutePower(data, eeDeviceId);
  const portPowerByMinute = new Map<number, number>();
  const deviceContributions = new Map<number, number>();

  deviceMinutePower.forEach((minuteMap, deviceId) => {
    let contribution = 0;

    minuteMap.forEach((watts, minute) => {
      const positivePower = Math.max(0, watts);
      contribution += positivePower;
      portPowerByMinute.set(minute, (portPowerByMinute.get(minute) || 0) + positivePower);
    });

    deviceContributions.set(deviceId, contribution);
  });

  let maxPowerWatts = 0;
  portPowerByMinute.forEach(watts => {
    if (watts > maxPowerWatts) maxPowerWatts = watts;
  });

  const totalContribution = Array.from(deviceContributions.values()).reduce((sum, value) => sum + value, 0);

  let topDeviceId: number | null = null;
  let topContribution = 0;

  deviceContributions.forEach((value, deviceId) => {
    if (value > topContribution) {
      topContribution = value;
      topDeviceId = deviceId;
    }
  });

  const topMeter = topDeviceId !== null ? meters.find(meter => meter.id === topDeviceId) : undefined;
  const topConsumerPercentage = totalContribution > 0
    ? Math.round((topContribution / totalContribution) * 100)
    : 0;

  return {
    maxPower: maxPowerWatts / 1000,
    topConsumerName: topMeter
      ? getMeterDisplayName(topMeter)
      : topDeviceId !== null
        ? `Device ${topDeviceId}`
        : 'N/A',
    topConsumerPercentage,
  };
}

function getDeviceColor(deviceName: string) {
  const colors = [
    { bg: 'rgba(59, 130, 246, 0.8)', border: 'rgb(59, 130, 246)' },
    { bg: 'rgba(16, 185, 129, 0.8)', border: 'rgb(16, 185, 129)' },
    { bg: 'rgba(245, 158, 11, 0.8)', border: 'rgb(245, 158, 11)' },
    { bg: 'rgba(239, 68, 68, 0.8)', border: 'rgb(239, 68, 68)' },
    { bg: 'rgba(139, 92, 246, 0.8)', border: 'rgb(139, 92, 246)' },
    { bg: 'rgba(236, 72, 153, 0.8)', border: 'rgb(236, 72, 153)' },
    { bg: 'rgba(6, 182, 212, 0.8)', border: 'rgb(6, 182, 212)' },
    { bg: 'rgba(251, 146, 60, 0.8)', border: 'rgb(251, 146, 60)' },
    { bg: 'rgba(132, 204, 22, 0.8)', border: 'rgb(132, 204, 22)' },
    { bg: 'rgba(20, 184, 166, 0.8)', border: 'rgb(20, 184, 166)' },
    { bg: 'rgba(234, 179, 8, 0.8)', border: 'rgb(234, 179, 8)' },
    { bg: 'rgba(168, 85, 247, 0.8)', border: 'rgb(168, 85, 247)' },
    { bg: 'rgba(244, 114, 182, 0.8)', border: 'rgb(244, 114, 182)' },
    { bg: 'rgba(14, 165, 233, 0.8)', border: 'rgb(14, 165, 233)' },
    { bg: 'rgba(34, 197, 94, 0.8)', border: 'rgb(34, 197, 94)' },
    { bg: 'rgba(249, 115, 22, 0.8)', border: 'rgb(249, 115, 22)' },
    { bg: 'rgba(163, 230, 53, 0.8)', border: 'rgb(163, 230, 53)' },
    { bg: 'rgba(124, 58, 237, 0.8)', border: 'rgb(124, 58, 237)' },
    { bg: 'rgba(219, 39, 119, 0.8)', border: 'rgb(219, 39, 119)' },
  ];

  let hash = 0;
  for (let i = 0; i < deviceName.length; i++) {
    hash = deviceName.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

export default function PortEnergyOverview() {
  const t = useTranslation();
  const router = useRouter();

  const [meters, setMeters] = useState<Meter[]>([]);
  const [periodData, setPeriodData] = useState<SeriesResponse | null>(null);
  const [values, setValues] = useState<DashboardValues>({
    totalDevices: 0,
    currentTotalPower: 0,
    averagePowerFactor: 0,
  });
  const [analytics, setAnalytics] = useState<AnalyticsValues>({
    monthlyEnergy: 0,
    maxPower: 0,
    topConsumerName: 'N/A',
    topConsumerPercentage: 0,
  });
  const [loading, setLoading] = useState<LoadingState>({
    meters: true,
    power: true,
    powerFactor: true,
    monthlyEnergy: true,
    periodAnalytics: true,
  });
  const [errors, setErrors] = useState<ErrorState>({
    meters: null,
    power: null,
    powerFactor: null,
    monthlyEnergy: null,
    periodAnalytics: null,
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('15min');
  const [selectedMeterIds, setSelectedMeterIds] = useState<number[]>([]);
  const [chartFontFamily, setChartFontFamily] = useState('');

  useEffect(() => {
    const fontFamily = window.getComputedStyle(document.body).fontFamily;

    if (fontFamily) {
      ChartJS.defaults.font.family = fontFamily;
      setChartFontFamily(fontFamily);
    }
  }, []);

  useEffect(() => {
    const loadMeters = async () => {
      const token = authService.getToken();
      const tokenType = authService.getTokenType();

      if (!token) {
        authService.logout();
        router.replace('/login');
        return;
      }

      try {
        const response = await fetch(`${BACKEND_URL}/api/meters`, {
          headers: {
            Accept: 'application/json',
            Authorization: `${tokenType} ${token}`,
          },
          cache: 'no-store',
        });

        if (response.status === 401) {
          authService.logout();
          router.replace('/login');
          return;
        }

        if (!response.ok) throw new Error(`Meters API ${response.status}`);

        const data = (await response.json()) as Meter[];
        setMeters(data);
        setValues(current => ({ ...current, totalDevices: data.length }));
        setLoading(current => ({ ...current, meters: false }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load meters';
        console.error('Meters error:', message);
        setErrors(current => ({ ...current, meters: message }));
        setLoading(current => ({ ...current, meters: false }));
      }
    };

    void loadMeters();
  }, [router]);

  useEffect(() => {
    if (!meters.length) return;

    const loadMainMetrics = async () => {
      const token = authService.getToken();
      const tokenType = authService.getTokenType();

      if (!token) {
        authService.logout();
        router.replace('/login');
        return;
      }

      const headers = {
        Accept: 'application/json',
        Authorization: `${tokenType} ${token}`,
        'Content-Type': 'application/json',
      };

      const eeMeter = meters.find(meter => meter.tags?.includes(EE_TAG_ID));

      if (!eeMeter) {
        console.error('EE meter not found');
        return;
      }

      const powerPayload = buildPowerPayload(eeMeter.id, eeMeter.idSite);
      const powerFactorPayload = buildPowerFactorPayload(eeMeter.idSite);
      const monthlyPayload = buildMonthlyEnergyPayload(eeMeter.id, eeMeter.idSite);

      try {
        const [powerResponse, powerFactorResponse, monthlyResponse] = await Promise.all([
          fetch(`${BACKEND_URL}/api/series/data_lake`, {
            method: 'POST',
            headers,
            body: JSON.stringify(powerPayload),
          }),
          fetch(`${BACKEND_URL}/api/series/data_lake`, {
            method: 'POST',
            headers,
            body: JSON.stringify(powerFactorPayload),
          }),
          fetch(`${BACKEND_URL}/api/series/data_lake`, {
            method: 'POST',
            headers,
            body: JSON.stringify(monthlyPayload),
          }),
        ]);

        if (
          powerResponse.status === 401 ||
          powerFactorResponse.status === 401 ||
          monthlyResponse.status === 401
        ) {
          authService.logout();
          router.replace('/login');
          return;
        }

        if (powerResponse.ok) {
          const data = (await powerResponse.json()) as SeriesResponse;
          const power = calculateCurrentTotalPower(data, eeMeter.id);
          setValues(current => ({
            ...current,
            currentTotalPower: Math.round(power * 100) / 100,
          }));
        }

        setLoading(current => ({ ...current, power: false }));

        if (powerFactorResponse.ok) {
          const data = (await powerFactorResponse.json()) as SeriesResponse;
          const pf = calculateAveragePowerFactor(data, eeMeter.id);

          setValues(current => ({
            ...current,
            averagePowerFactor: Math.round(pf * 100) / 100,
          }));
        }

        setLoading(current => ({ ...current, powerFactor: false }));

        if (monthlyResponse.ok) {
          const data = (await monthlyResponse.json()) as SeriesResponse;
          const monthlyEnergy = calculateMonthlyEnergy(data, eeMeter.id);

          setAnalytics(current => ({
            ...current,
            monthlyEnergy: Math.round(monthlyEnergy),
          }));
        }

        setLoading(current => ({ ...current, monthlyEnergy: false }));
        setLastUpdated(new Date());
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load metrics';
        console.error('Metrics error:', message);
      }
    };

    void loadMainMetrics();
  }, [meters, router]);

  useEffect(() => {
    if (!meters.length) return;

    const loadPeriodAnalytics = async () => {
      const token = authService.getToken();
      const tokenType = authService.getTokenType();

      if (!token) {
        authService.logout();
        router.replace('/login');
        return;
      }

      const eeMeter = meters.find(meter => meter.tags?.includes(EE_TAG_ID));
      if (!eeMeter) return;

      setLoading(current => ({ ...current, periodAnalytics: true }));
      setErrors(current => ({ ...current, periodAnalytics: null }));

      try {
        const payload = buildPeriodAnalyticsPayload(eeMeter.idSite, timePeriod);

        const response = await fetch(`${BACKEND_URL}/api/series/data_lake`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `${tokenType} ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.status === 401) {
          authService.logout();
          router.replace('/login');
          return;
        }

        if (!response.ok) throw new Error(`Analytics API ${response.status}`);

        const data = (await response.json()) as SeriesResponse;
        setPeriodData(data);

        const result = calculatePeriodAnalytics(data, eeMeter.id, meters);

        setAnalytics(current => ({
          ...current,
          maxPower: Math.round(result.maxPower * 100) / 100,
          topConsumerName: result.topConsumerName,
          topConsumerPercentage: result.topConsumerPercentage,
        }));

        setLastUpdated(new Date());
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : 'Failed to load period analytics';

        console.error('Period analytics error:', message);
        setErrors(current => ({ ...current, periodAnalytics: message }));
        setPeriodData(null);
      } finally {
        setLoading(current => ({ ...current, periodAnalytics: false }));
      }
    };

    void loadPeriodAnalytics();
  }, [meters, timePeriod, router]);

  const chartMeterOptions = useMemo(() => {
    if (!periodData?.series?.length) return [];

    const eeMeter = meters.find(meter => meter.tags?.includes(EE_TAG_ID));

    const meterIdsWithData = new Set(
      periodData.series
        .filter(series =>
          series.device !== eeMeter?.id &&
          [6, 7, 8].includes(series.metric_type)
        )
        .map(series => series.device)
    );

    return meters
      .filter(meter => meterIdsWithData.has(meter.id))
      .sort((a, b) => a.id - b.id);
  }, [periodData, meters]);

  useEffect(() => {
    if (!chartMeterOptions.length) {
      setSelectedMeterIds([]);
      return;
    }

    setSelectedMeterIds(current => {
      const validIds = current.filter(id =>
        chartMeterOptions.some(meter => meter.id === id)
      );

      return validIds.length
        ? validIds
        : [chartMeterOptions[0].id];
    });
  }, [chartMeterOptions]);

  const toggleChartMeter = (meterId: number) => {
    setSelectedMeterIds(current =>
      current.includes(meterId)
        ? current.filter(id => id !== meterId)
        : [...current, meterId]
    );
  };

  const selectedMeterLabel = useMemo(() => {
    if (!selectedMeterIds.length) return t.selectDevices;

    if (selectedMeterIds.length === 1) {
      const meter = meters.find(item => item.id === selectedMeterIds[0]);
      return getMeterDisplayName(meter, selectedMeterIds[0]);
    }

    return `${selectedMeterIds.length} ${t.devicesSelected}`;
  }, [selectedMeterIds, meters, t.selectDevices, t.devicesSelected]);

  const stackedChartData = useMemo(() => {
    if (!periodData?.series?.length) return { labels: [] as Date[], datasets: [] };

    const eeMeter = meters.find(meter => meter.tags?.includes(EE_TAG_ID));
    if (!eeMeter) return { labels: [] as Date[], datasets: [] };

    const periodMinutes = getTimePeriodMinutes(timePeriod);
    let bucketInterval = 1;
    let numBuckets = periodMinutes;

    if (periodMinutes > 60) {
      bucketInterval = Math.ceil(periodMinutes / 60);
      numBuckets = Math.ceil(periodMinutes / bucketInterval);
    }

    const timestamps = periodData.series.flatMap(series =>
      series.records.map(record => new Date(record[3]).getTime())
    );

    if (!timestamps.length) return { labels: [] as Date[], datasets: [] };

    const latestDataTime = new Date(Math.max(...timestamps));
    latestDataTime.setSeconds(0, 0);

    const startTime = new Date(
      latestDataTime.getTime() -
      (numBuckets - 1) * bucketInterval * 60 * 1000
    );

    const buckets = Array.from(
      { length: numBuckets },
      (_, index) =>
        new Date(
          startTime.getTime() +
          index * bucketInterval * 60 * 1000
        )
    );

    const deviceMinutePower = buildDeviceMinutePower(periodData, eeMeter.id);
    const selectedIds = new Set(selectedMeterIds);

    const devices = Array.from(deviceMinutePower.keys())
      .filter(deviceId => selectedIds.has(deviceId))
      .sort((a, b) => a - b);

    const datasets = devices.map(deviceId => {
      const meter = meters.find(meter => meter.id === deviceId);
      const name = getMeterDisplayName(meter, deviceId);
      const color = getDeviceColor(name);
      const minuteMap = deviceMinutePower.get(deviceId);
      const values: number[] = [];

      let lastValue = 0;

      buckets.forEach(bucket => {
        const bucketStart = bucket.getTime();
        const bucketEnd = bucketStart + bucketInterval * 60 * 1000;

        let newestTimestamp = -1;
        let newestValue: number | null = null;

        minuteMap?.forEach((watts, minute) => {
          if (
            minute >= bucketStart &&
            minute < bucketEnd &&
            minute > newestTimestamp
          ) {
            newestTimestamp = minute;
            newestValue = Math.max(0, watts / 1000);
          }
        });

        if (newestValue !== null) lastValue = newestValue;
        values.push(lastValue);
      });

      return {
        label: name,
        data: values,
        backgroundColor: color.bg,
        borderColor: color.border,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: color.border,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
      };
    });

    return { labels: buckets, datasets };
  }, [periodData, meters, timePeriod, selectedMeterIds]);

  const chartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          boxWidth: 10,
          padding: 6,
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 9 },
        },
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        position: 'nearest',
        backgroundColor: 'rgba(17, 24, 39, 0.97)',
        titleColor: '#fff',
        bodyColor: '#e5e7eb',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        boxWidth: 10,
        boxHeight: 10,
        usePointStyle: true,
        bodySpacing: 5,
        titleFont: { size: 13, weight: 'bold' },
        bodyFont: { size: 11 },
        footerFont: { size: 12, weight: 'bold' },
        callbacks: {
          title: items => {
            if (!items.length) return '';

            return new Date(items[0].parsed.x).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
          },
          beforeBody: items => {
            const activeDevices = items.filter(item => item.parsed.y >= 0.1).length;
            if (activeDevices <= 10) return [];
            return [`📊 ${activeDevices} active devices - Top 10 shown`];
          },
          label: context => {
            if (!context.parsed.y || context.parsed.y < 0.1) return '';

            const allItems = context.chart.tooltip?.dataPoints || [];
            const sortedItems = [...allItems]
              .filter(item => item.parsed.y >= 0.1)
              .sort((a, b) => b.parsed.y - a.parsed.y);

            const index = sortedItems.findIndex(
              item => item.datasetIndex === context.datasetIndex
            );

            if (index >= 10) return '';

            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} ${t.kW}`;
          },
          afterBody: items => {
            const sortedItems = [...items]
              .filter(item => item.parsed.y >= 0.1)
              .sort((a, b) => b.parsed.y - a.parsed.y);

            if (sortedItems.length <= 10) return [];

            const others = sortedItems.slice(10);
            const othersPower = others.reduce(
              (sum, item) => sum + item.parsed.y,
              0
            );

            return [`+ ${others.length} other devices: ${othersPower.toFixed(2)} ${t.kW}`];
          },
          footer: items => {
            const total = items.reduce((sum, item) => sum + item.parsed.y, 0);
            return `━━━━━━━━━━━━━\nTotal: ${total.toFixed(2)} ${t.kW}`;
          },
        },
      },
      filler: { propagate: true },
    },
    scales: {
      x: {
        type: 'time',
        stacked: true,
        time: {
          displayFormats: {
            minute: 'HH:mm',
            hour: 'HH:mm',
          },
          unit: timePeriod === '6hours' ? 'hour' : 'minute',
          tooltipFormat: 'HH:mm',
          minUnit: 'minute',
        },
        grid: { display: false },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
          color: '#6b7280',
          font: { size: 11 },
        },
        border: { display: false },
      },
      y: {
        stacked: true,
        beginAtZero: false,
        suggestedMin: 0,
        grid: {
          color: 'rgba(0, 0, 0, 0.08)',
        },
        ticks: {
          callback: value =>
            Number(value) < 0
              ? ''
              : `${value} kW`,
          color: '#6b7280',
          padding: 8,
          font: { size: 11 },
        },
        border: { display: false },
      },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    elements: {
      line: { tension: 0.4 },
    },
  }), [timePeriod, t.kW, chartFontFamily]);

  const getTimePeriodLabel = (period: TimePeriod) => {
    switch (period) {
      case '15min': return t.last15Minutes;
      case '30min': return t.last30Minutes;
      case '1hour': return t.lastHour;
      case '3hours': return t.last3Hours;
      case '6hours': return t.last6Hours;
    }
  };

  const periodOptions: { value: TimePeriod; label: string }[] = [
    { value: '15min', label: t.last15Minutes },
    { value: '30min', label: t.last30Minutes },
    { value: '1hour', label: t.lastHour },
    { value: '3hours', label: t.last3Hours },
    { value: '6hours', label: t.last6Hours },
  ];

  const apiConnected = !loading.meters && !errors.meters;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      {/* Header */}
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

      {/* Current Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <MetricCard
          title={t.totalDevicesLabel}
          value={values.totalDevices}
          icon={Database}
          variant="blue"
          loading={loading.meters}
          error={!!errors.meters}
        />

        <MetricCard
          title={t.currentTotalPowerLabel}
          value={values.currentTotalPower}
          unit={t.kW}
          icon={Zap}
          variant="yellow"
          loading={loading.power}
          error={!!errors.power}
        />

        <MetricCard
          title={t.averagePowerFactorLabel}
          value={values.averagePowerFactor}
          icon={Activity}
          variant="purple"
          loading={loading.powerFactor}
          error={!!errors.powerFactor}
        />
      </div>

      {/* Time Period */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 border border-gray-200 dark:border-gray-700 mb-6">
        <label className="flex items-center text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
          <Clock className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
          {t.timePeriod}
        </label>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {periodOptions.map(option => (
            <button
              key={option.value}
              onClick={() => setTimePeriod(option.value)}
              disabled={loading.periodAnalytics}
              className={`px-3 py-2 rounded-lg font-medium transition-all duration-200 border-2 ${
                timePeriod === option.value
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-600 hover:shadow-sm'
              } ${loading.periodAnalytics ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className="text-sm">{option.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Device Power Distribution */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="flex items-center text-xl font-semibold text-gray-800 dark:text-gray-200">
            <Activity className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
            {t.devicePowerDistribution} - {getTimePeriodLabel(timePeriod)}
          </h3>

          <details className="relative">
            <summary className="flex min-w-[280px] cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 [&::-webkit-details-marker]:hidden">
              <span className="max-w-[230px] truncate">{selectedMeterLabel}</span>

              <svg
                className="h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </summary>

            <div className="absolute right-0 z-50 mt-2 w-[340px] rounded-lg border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-600 dark:bg-gray-800">
              <div className="mb-2 flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedMeterIds(
                      chartMeterOptions.map(meter => meter.id)
                    )
                  }
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  {t.selectAll}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMeterIds([])}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400"
                >
                  {t.clear}
                </button>
              </div>

              <div className="max-h-64 space-y-1 overflow-y-auto">
                {chartMeterOptions.map(meter => {
                  const checked = selectedMeterIds.includes(meter.id);

                  return (
                    <label
                      key={meter.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleChartMeter(meter.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />

                      <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-200">
                        {getMeterDisplayName(meter)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </details>
        </div>

        <div className="h-96">
          {loading.periodAnalytics ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              <span className="ml-2 text-gray-500 dark:text-gray-400">
                {t.loadingData}
              </span>
            </div>
          ) : !selectedMeterIds.length ? (
            <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
              {t.noDevicesSelected}
            </div>
          ) : stackedChartData.datasets.length > 0 ? (
            <Line data={stackedChartData} options={chartOptions} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
              {t.noDataAvailable}
            </div>
          )}
        </div>
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        <MetricCard
          title={t.monthlyEnergyLabel}
          value={analytics.monthlyEnergy.toLocaleString()}
          unit={`${t.kWh}`}
          icon={Zap}
          variant="indigo"
          loading={loading.monthlyEnergy}
          error={!!errors.monthlyEnergy}
        />

        <MetricCard
          title={t.maxPowerLabel}
          value={analytics.maxPower}
          unit={`${t.kW}`}
          icon={TrendingUp}
          variant="rose"
          loading={loading.periodAnalytics}
          error={!!errors.periodAnalytics}
        />

        <MetricCard
          title={t.topConsumerLabel}
          value={analytics.topConsumerName}
          unit={`- ${analytics.topConsumerPercentage}%`}
          icon={PieChart}
          variant="amber"
          loading={loading.periodAnalytics}
          error={!!errors.periodAnalytics}
        />
      </div>

      {/* Last Update */}
      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <p>
          {t.lastUpdated}:{' '}
          {lastUpdated ? lastUpdated.toLocaleTimeString() : t.na}
        </p>
      </div>
    </div>
  );
}