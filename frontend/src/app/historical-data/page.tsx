
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DeviceSelection from '../../components/historical-data/DeviceSelection';
import DataDisplay from '../../components/historical-data/DataDisplay';
import { useTranslation } from '../../hooks/useTranslation';
import { authService } from '../../lib/Auth';
import type { EnergyData } from '../../types/EnergyData';
import {
  PV_POWER_MEAN,
  GRID_ACTIVE_POWER,
} from '../../types/EnergyData';

type DateRangeType = 'single' | '3days' | 'week' | 'custom';
type SeriesRecord = [number, number, number, string, number];
type DeviceType = 'meter' | 'pv';

interface MeterPVDevice {
  id: number;
  idSite: number | null;
  name: string;
  tags: number[];
  device_type: DeviceType;
  extra?: string | { friendlyName?: string } | null;
}

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

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

const DEVICES_URL = `${BACKEND_URL}/api/devices`;
const SERIES_URL = `${BACKEND_URL}/api/series/data_lake`;

const PORT_SITE_ID = 3;
const ACTIVE_POWER_UNIT = 12;
const ACTIVE_POWER_L1 = 6;
const ACTIVE_POWER_L2 = 7;
const ACTIVE_POWER_L3 = 8;

function getToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().split('T')[0];
}

function getDateRange(
  selectedDate: string,
  endDate: string,
  type: DateRangeType
) {
  const today = getToday();

  if (type === '3days') {
    return {
      start_dtm: `${addDays(today, -2)}T00:00:00.000Z`,
      end_dtm: `${today}T23:59:59.999Z`,
    };
  }

  if (type === 'week') {
    return {
      start_dtm: `${addDays(today, -6)}T00:00:00.000Z`,
      end_dtm: `${today}T23:59:59.999Z`,
    };
  }

  if (type === 'custom') {
    return {
      start_dtm: `${selectedDate}T00:00:00.000Z`,
      end_dtm: `${endDate || selectedDate}T23:59:59.999Z`,
    };
  }

  return {
    start_dtm: `${selectedDate}T00:00:00.000Z`,
    end_dtm: `${selectedDate}T23:59:59.999Z`,
  };
}

function getDeviceMetrics(device: MeterPVDevice): number[] {
  if (device.device_type === 'meter') {
    return [
      ACTIVE_POWER_L1,
      ACTIVE_POWER_L2,
      ACTIVE_POWER_L3,
    ];
  }

  if (device.device_type === 'pv') {
    const name = device.name.toLowerCase().trim();

    if (name.includes('interlink')) {
      return [GRID_ACTIVE_POWER];
    }

    if (name.includes('pv')) {
      return [PV_POWER_MEAN];
    }
  }

  return [];
}

function getDeviceUnit(device: MeterPVDevice): number[] {
  return device.device_type === 'meter'
    ? [ACTIVE_POWER_UNIT]
    : [];
}

function buildHistoricalPayload(
  siteId: number,
  selectedDevice: string | null,
  selectedDate: string,
  endDate: string,
  dateRangeType: DateRangeType,
  devices: MeterPVDevice[]
) {
  const { start_dtm, end_dtm } = getDateRange(
    selectedDate,
    endDate,
    dateRangeType
  );

  const selectedDevices = selectedDevice
    ? devices.filter(device => String(device.id) === selectedDevice)
    : devices;

  const series = selectedDevices
    .filter(device => device.idSite === siteId)
    .map(device => ({
      sources: ['data_lake'],
      site: [siteId],
      site_type: ['port'],
      device: [device.id],
      device_type: [],
      metric_type: getDeviceMetrics(device),
      unit: getDeviceUnit(device),
      field: 'default',
    }))
    .filter(item => item.metric_type.length > 0);

  return {
    start_dtm,
    end_dtm,
    series,
  };
}

function getDeviceFriendlyName(
  device: MeterPVDevice
): string | null {
  if (!device.extra) return null;

  try {
    const extra =
      typeof device.extra === 'string'
        ? JSON.parse(device.extra)
        : device.extra;

    return typeof extra?.friendlyName === 'string' &&
      extra.friendlyName.trim()
      ? extra.friendlyName.trim()
      : null;
  } catch {
    return null;
  }
}

function normalizeDevices(data: unknown): MeterPVDevice[] {
  if (!Array.isArray(data)) {
    throw new Error('Devices API returned an invalid response.');
  }

  return data
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null
    )
    .filter(item =>
      item.device_type === 'meter' ||
      item.device_type === 'pv'
    )
    .filter(item =>
      item.idSite != null &&
      Number(item.idSite) === PORT_SITE_ID
    )
    .map((item): MeterPVDevice => ({
      id: Number(item.id),
      idSite: Number(item.idSite),
      name: String(item.name || `Device ${item.id}`),
      device_type: item.device_type as DeviceType,
      tags: Array.isArray(item.tags)
        ? item.tags.map(Number)
        : [],
      extra: item.extra as MeterPVDevice['extra'],
    }))
    .filter(device => Number.isFinite(device.id));
}

function transformAtlasData(
  data: SeriesResponse,
  devices: MeterPVDevice[]
): EnergyData[] {
  if (!Array.isArray(data.series)) return [];

  const rows = new Map<string, EnergyData>();
  const deviceById = new Map(
    devices.map(device => [device.id, device])
  );

  for (const series of data.series) {
    if (!Array.isArray(series.records)) continue;

    for (const record of series.records) {
      const deviceId = Number(record[1]);
      const metricType = Number(record[2]);
      const timestamp = record[3];
      const value = record[4];
      const device = deviceById.get(deviceId);

      if (
        !device ||
        !timestamp ||
        typeof value !== 'number' ||
        !Number.isFinite(value)
      ) {
        continue;
      }

      if (!getDeviceMetrics(device).includes(metricType)) {
        continue;
      }

      const key = `${deviceId}-${timestamp}`;
      let row = rows.get(key);

      if (!row) {
        row = {
          _id: key,
          timestamp,
          device: String(deviceId),
          deviceName: device.name,
          L1: { P: 0 },
          L2: { P: 0 },
          L3: { P: 0 },
          measure_cons: 0,
          producer: 'data_lake',
        };

        rows.set(key, row);
      }

      if (device.device_type === 'meter') {
        if (metricType === ACTIVE_POWER_L1 && row.L1) {
          row.L1.P = value;
        }

        if (metricType === ACTIVE_POWER_L2 && row.L2) {
          row.L2.P = value;
        }

        if (metricType === ACTIVE_POWER_L3 && row.L3) {
          row.L3.P = value;
        }

        row.measure_cons =
          (row.L1?.P ?? 0) +
          (row.L2?.P ?? 0) +
          (row.L3?.P ?? 0);
      } else {
        // Multiply by -1 (VALUES FROM PV ARE CURRENTLY NEGATIVE)
        row.measure_cons = metricType === PV_POWER_MEAN ? -value : value;
      }
    }
  }

  return Array.from(rows.values()).sort(
    (a, b) =>
      new Date(a.timestamp).getTime() -
      new Date(b.timestamp).getTime()
  );
}

export default function HistoricalPortDataPage() {
  const t = useTranslation();
  const router = useRouter();

  const [devices, setDevices] = useState<MeterPVDevice[]>([]);
  const [filteredData, setFilteredData] = useState<EnergyData[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getToday());
  const [dateRangeType, setDateRangeType] =
    useState<DateRangeType>('single');

  const [isLoadingDevices, setIsLoadingDevices] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allDeviceList = useMemo(() => {
    return [...devices]
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      )
      .map(device => {
        const name = device.name || `Device ${device.id}`;
        const friendlyName = getDeviceFriendlyName(device);

        return {
          id: String(device.id),
          name: friendlyName
            ? `${name} • ${friendlyName}`
            : name,
        };
      });
  }, [devices]);

  const selectActiveDeviceList = useMemo(() => {
    const activeIds = new Set(
      filteredData.map(item => item.device)
    );

    return allDeviceList.filter(device =>
      activeIds.has(device.id)
    );
  }, [filteredData, allDeviceList]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadDevices = async () => {
      const token = authService.getToken();
      const tokenType = authService.getTokenType();

      if (!token) {
        authService.logout();
        router.replace('/login');
        return;
      }

      try {
        setIsLoadingDevices(true);
        setError(null);

        console.log('Devices API URL:', DEVICES_URL);

        const response = await fetch(DEVICES_URL, {
          headers: {
            Accept: 'application/json',
            Authorization: `${tokenType} ${token}`,
          },
          cache: 'no-store',
          signal: controller.signal,
        });

        if (cancelled) return;

        console.log('Devices API status:', response.status);

        if (response.status === 401) {
          authService.logout();
          router.replace('/login');
          return;
        }

        if (!response.ok) {
          const body = await response.text();

          console.error('Devices API response body:', body);

          throw new Error(
            `Devices API ${response.status} (${response.url})`
          );
        }

        const json: unknown = await response.json();

        if (cancelled) return;

        console.log('All devices received:', json);

        if (!Array.isArray(json)) {
          throw new Error(
            'Devices API returned an invalid response.'
          );
        }

        const portDevices = normalizeDevices(json);

        const meters = portDevices.filter(
          device => device.device_type === 'meter'
        );

        const pvs = portDevices.filter(
          device => device.device_type === 'pv'
        );

        console.log('Filtered devices:', portDevices);
        console.log('Meter devices:', meters);
        console.log('PV / Interlink devices:', pvs);

        console.log('Devices loaded:', {
          total: portDevices.length,
          meters: meters.length,
          pvs: pvs.length,
        });

        if (!cancelled) {
          setDevices(portDevices);
        }
      } catch (err) {
        if (
          cancelled ||
          (err instanceof Error && err.name === 'AbortError')
        ) return;

        const message =
          err instanceof Error
            ? err.message
            : 'Failed to load devices';

        console.error('Historical devices error:', message);
        setError(message);
        setDevices([]);
      } finally {
        if (!cancelled) {
          setIsLoadingDevices(false);
        }
      }
    };

    void loadDevices();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [router]);

  const fetchHistoricalData = async () => {
    if (!devices.length) return;

    const token = authService.getToken();
    const tokenType = authService.getTokenType();

    if (!token) {
      authService.logout();
      router.replace('/login');
      return;
    }

    if (
      dateRangeType === 'custom' &&
      new Date(`${endDate}T00:00:00Z`) <
        new Date(`${selectedDate}T00:00:00Z`)
    ) {
      setError('End date cannot be earlier than start date.');
      return;
    }

    try {
      setIsSearching(true);
      setError(null);

      const payload = buildHistoricalPayload(
        PORT_SITE_ID,
        selectedDevice,
        selectedDate,
        endDate,
        dateRangeType,
        devices
      );

      console.log(
        'Historical request:',
        JSON.stringify(payload, null, 2)
      );

      const response = await fetch(SERIES_URL, {
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

      if (!response.ok) {
        const body = await response.text();

        throw new Error(
          `Historical API ${response.status}: ${body}`
        );
      }

      const data =
        (await response.json()) as SeriesResponse;

      if (!Array.isArray(data.series)) {
        throw new Error('Invalid historical series response.');
      }

      console.table(
        data.series.map(series => ({
          device: series.device,
          metric: series.metric_type,
          records: series.records?.length ?? 0,
        }))
      );

      const transformedData = transformAtlasData(
        data,
        devices
      );

      console.log(
        'Historical records transformed:',
        transformedData.length
      );

      console.log(
        'Historical devices with data:',
        [...new Set(transformedData.map(item => item.device))]
      );

      setFilteredData(transformedData);
      setHasSearched(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load historical data';

      console.error('Historical data error:', message);

      setFilteredData([]);
      setHasSearched(true);
      setError(message);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (!devices.length || isLoadingDevices) return;

    void fetchHistoricalData();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRangeType, devices, isLoadingDevices]);

  const handleDateChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    setSelectedDate(value);

    if (
      dateRangeType === 'custom' &&
      endDate < value
    ) {
      setEndDate(value);
    }
  };

  const handleDateRangeTypeChange = (
    type: DateRangeType
  ) => {
    setDateRangeType(type);

    if (type === 'custom') {
      setSelectedDate(getToday());
      setEndDate(getToday());
    }
  };

  return (
    <div className="p-6">
      <div className="container mx-auto space-y-9 relative z-0">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t.historicalPortEnergyData}
        </h1>

        {error && (
          <div className="px-4 py-3 rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <DeviceSelection
          deviceList={selectActiveDeviceList}
          allDeviceList={allDeviceList}
          selectedDevice={selectedDevice}
          selectedDate={selectedDate}
          isSearching={isSearching}
          handleDeviceSelect={setSelectedDevice}
          handleDateChange={handleDateChange}
          fetchHistoricalData={fetchHistoricalData}
          dateRangeType={dateRangeType}
          onDateRangeTypeChange={handleDateRangeTypeChange}
          endDate={endDate}
          onEndDateChange={event =>
            setEndDate(event.target.value)
          }
        />

        {isLoadingDevices || (!hasSearched && isSearching) ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent" />
            <p className="mt-3 text-gray-600 dark:text-gray-400">
              {t.loadingData}
            </p>
          </div>
        ) : hasSearched ? (
          <DataDisplay
            filteredData={filteredData}
            deviceList={allDeviceList}
            selectedDevice={selectedDevice}
            selectedDate={selectedDate}
            isHistoricalView
            isLoading={isSearching}
          />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400">
              {error || t.loadingData}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
