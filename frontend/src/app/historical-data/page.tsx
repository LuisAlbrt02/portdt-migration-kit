'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DeviceSelection from '../../components/historical-data/DeviceSelection';
import DataDisplay from '../../components/historical-data/DataDisplay';
import { useTranslation } from '../../hooks/useTranslation';
import { authService } from '../../lib/Auth';
import type { EnergyData } from '../../types/EnergyData';

type DateRangeType = 'single' | '3days' | 'week' | 'custom';
type SeriesRecord = [number, number, number, string, number];

interface Meter {
  id: number;
  idSite: number;
  name: string;
  tags: number[];
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

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
const ACTIVE_POWER_UNIT = 12;
const ACTIVE_POWER_L1 = 6;
const ACTIVE_POWER_L2 = 7;
const ACTIVE_POWER_L3 = 8;

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().split('T')[0];
}

function getDateRange(selectedDate: string, endDate: string, type: DateRangeType) {
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

function buildHistoricalPayload(
  siteId: number,
  selectedDevice: string | null,
  selectedDate: string,
  endDate: string,
  dateRangeType: DateRangeType
) {
  const { start_dtm, end_dtm } = getDateRange(
    selectedDate,
    endDate,
    dateRangeType
  );

  const specificDevice = selectedDevice !== null;

  return {
    start_dtm,
    end_dtm,
    series: [{
      sources: ['data_lake'],
      site: [siteId],
      site_type: ['port'],
      device: specificDevice ? [Number(selectedDevice)] : [],
      device_type: specificDevice ? [] : ['meter'],
      metric_type: [0],
      unit: [ACTIVE_POWER_UNIT],
      field: 'default',
    }],
  };
}

function getMeterFriendlyName(meter: Meter): string | null {
  if (!meter.extra) return null;

  try {
    const extra = typeof meter.extra === 'string'
      ? JSON.parse(meter.extra)
      : meter.extra;

    return typeof extra?.friendlyName === 'string' && extra.friendlyName.trim()
      ? extra.friendlyName.trim()
      : null;
  } catch {
    return null;
  }
}

function transformAtlasData(data: SeriesResponse, meters: Meter[]): EnergyData[] {
  if (!Array.isArray(data.series)) return [];

  const rows = new Map<string, EnergyData>();
  const meterNames = new Map(
    meters.map(meter => [meter.id, meter.name])
  );

  data.series.forEach(series => {
    if (
      series.metric_type !== ACTIVE_POWER_L1 &&
      series.metric_type !== ACTIVE_POWER_L2 &&
      series.metric_type !== ACTIVE_POWER_L3
    ) return;

    series.records.forEach(record => {
      const deviceId = record[1];
      const metricType = record[2];
      const timestamp = record[3];
      const value = record[4];

      if (typeof value !== 'number' || !Number.isFinite(value)) return;

      const key = `${deviceId}-${timestamp}`;
      let row = rows.get(key);

      if (!row) {
        row = {
          _id: key,
          timestamp,
          device: String(deviceId),
          deviceName: meterNames.get(deviceId) || `Device ${deviceId}`,
          L1: { P: 0 },
          L2: { P: 0 },
          L3: { P: 0 },
          measure_cons: 0,
          producer: 'data_lake',
        };

        rows.set(key, row);
      }

      if (metricType === ACTIVE_POWER_L1 && row.L1) row.L1.P = value;
      if (metricType === ACTIVE_POWER_L2 && row.L2) row.L2.P = value;
      if (metricType === ACTIVE_POWER_L3 && row.L3) row.L3.P = value;

      row.measure_cons =
        (row.L1?.P || 0) +
        (row.L2?.P || 0) +
        (row.L3?.P || 0);
    });
  });

  return Array.from(rows.values()).sort(
    (a, b) =>
      new Date(a.timestamp).getTime() -
      new Date(b.timestamp).getTime()
  );
}

export default function HistoricalPortDataPage() {
  const t = useTranslation();
  const router = useRouter();

  const [meters, setMeters] = useState<Meter[]>([]);
  const [filteredData, setFilteredData] = useState<EnergyData[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getToday());
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>('single');
  const [isLoadingMeters, setIsLoadingMeters] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * Lista utilizada por DataDisplay.
   * Aquí mantenemos únicamente D1, D2, D3...
   * para que la tabla no cambie.
   */
  const allDeviceList = useMemo(() => {
    return [...meters]
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      )
      .map(meter => {
        const name = meter.name || `Device ${meter.id}`;
        const friendlyName = getMeterFriendlyName(meter);

        return {
          id: String(meter.id),
          name: friendlyName ? `${name} • ${friendlyName}` : name,
        };
      });
  }, [meters]);

  const selectDeviceList = useMemo(() => {
    return [...meters]
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      )
      .map(meter => {
        const shortName = meter.name || `Device ${meter.id}`;
        const friendlyName = getMeterFriendlyName(meter);

        return {
          id: String(meter.id),
          name: friendlyName
            ? `${shortName} - ${friendlyName}`
            : shortName,
        };
      });
  }, [meters]);

  const selectActiveDeviceList = useMemo(() => {
    const activeIds = new Set(filteredData.map(item => item.device));
    return allDeviceList.filter(device => activeIds.has(device.id));
  }, [filteredData, allDeviceList]);

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
        setIsLoadingMeters(true);
        setError(null);

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

        if (!response.ok) {
          throw new Error(`Meters API ${response.status}`);
        }

        setMeters((await response.json()) as Meter[]);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load meters';

        console.error('Historical meters error:', message);
        setError(message);
      } finally {
        setIsLoadingMeters(false);
      }
    };

    void loadMeters();
  }, [router]);

  const fetchHistoricalData = async () => {
    if (!meters.length) return;

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

    const siteId = meters[0]?.idSite;

    if (siteId === undefined) {
      setError('Site could not be determined.');
      return;
    }

    try {
      setIsSearching(true);
      setError(null);

      const payload = buildHistoricalPayload(
        siteId,
        selectedDevice,
        selectedDate,
        endDate,
        dateRangeType
      );

      console.log(
        '📚 Historical request:',
        JSON.stringify(payload, null, 2)
      );

      const response = await fetch(
        `${BACKEND_URL}/api/series/data_lake`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `${tokenType} ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

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

      const data = (await response.json()) as SeriesResponse;
      const transformedData = transformAtlasData(data, meters);

      console.log(
        `📚 Historical records transformed: ${transformedData.length}`
      );

      setFilteredData(transformedData);
      setHasSearched(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load historical data';

      console.error('Historical data error:', message);

      setFilteredData([]);
      setHasSearched(true);
      setError(message);
    } finally {
      setIsSearching(false);
    }
  };

  /*
   * Ejecuta automáticamente Single Day al cargar la página
   * y vuelve a consultar cuando cambia el rango temporal.
   */
  useEffect(() => {
    if (!meters.length || isLoadingMeters) return;

    void fetchHistoricalData();

    // fetchHistoricalData intentionally uses the current page state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRangeType, meters.length, isLoadingMeters]);

  const handleDateChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    setSelectedDate(value);

    if (dateRangeType === 'custom' && endDate < value) {
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

        {isLoadingMeters || (!hasSearched && isSearching) ? (
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
              {t.loadingData}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}