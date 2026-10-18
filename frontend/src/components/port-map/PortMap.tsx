'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Map as MapGL, type MapRef, useControl } from 'react-map-gl/maplibre';
import type { DeckProps } from '@deck.gl/core';
import { MapLibreOverlay } from '@deck.gl/maplibre';
import { useRouter } from 'next/navigation';

import { authService } from '../../lib/Auth';
import type { EnergyData } from '../../types/EnergyData';
import type { Boat, BoatListResponse, PortGeofence } from '../../types/Boat';

import {
  BOAT_UI_REFRESH_MS,
  EE_TAG_ID,
  ENERGY_REFRESH_MS,
  FALLBACK_MAP_STYLE,
  INITIAL_VIEW_STATE,
  MAP_HISTORY_HOURS,
  MAP_STYLE,
  PORT_VIEW_STATE,
} from '../../config/portMap';

import { add3DBuildings } from './BuildingsLayer';
import { createBoatLayers, type BoatMapItem } from './BoatLayer';
import { createGeofenceLayer } from './GeofenceLayer';
import MapSensorPanel from './MapSensorPanel';
import TimeControls from './TimeControls';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

const LATITUDE_METRIC = 65;
const LONGITUDE_METRIC = 66;
const MAX_COORDINATE_SKEW_MS = 120_000;
const MAX_INTERPOLATION_GAP_MS = 5 * 60_000;
const MAX_NEAREST_POSITION_MS = 2 * 60_000;

interface Meter {
  id: number;
  name: string;
  idSite: number;
  tags?: number[];
}

type SeriesRecord = [number, number, number, string, number];

interface SeriesItem {
  records?: SeriesRecord[];
}

interface SeriesResponse {
  series?: SeriesItem[];
  data?: SeriesItem[];
}

interface BoatApiMapData {
  id?: number | string;
  deviceId?: number | string;
  device?: number | string;
  name?: string;
  latitude?: number | string;
  longitude?: number | string;
  timestamp?: string;
  lastPositionAt?: string;
  insidePortZone?: boolean;
  isInsideGeofence?: boolean;
}

interface CoordinateSample {
  time: number;
  value: number;
}

interface BoatPosition {
  deviceId: number;
  time: number;
  timestamp: string;
  latitude: number;
  longitude: number;
}

function DeckGLOverlay(props: DeckProps) {
  const deckProps = { ...props, interleaved: false };
  const overlay = useControl<MapLibreOverlay>(
    () => new MapLibreOverlay(deckProps)
  );

  overlay.setProps(deckProps);
  return null;
}

function getSeriesItems(
  payload: SeriesResponse | SeriesItem[]
): SeriesItem[] {
  return Array.isArray(payload)
    ? payload
    : payload.series || payload.data || [];
}

function groupEnergyRecords(
  payload: SeriesResponse | SeriesItem[],
  meters: Meter[]
): EnergyData[] {
  const meterNames = new Map(meters.map(meter => [meter.id, meter.name]));
  const grouped = new Map<string, EnergyData>();
  const bucketMs = 10_000;

  for (const series of getSeriesItems(payload)) {
    for (const record of series.records || []) {
      if (!Array.isArray(record) || record.length < 5) continue;

      const deviceId = Number(record[1]);
      const metricType = Number(record[2]);
      const timestamp = String(record[3]);
      const value = Number(record[4]);
      const timeMs = new Date(timestamp).getTime();

      if (
        !Number.isFinite(deviceId) ||
        !Number.isFinite(metricType) ||
        !Number.isFinite(value) ||
        !Number.isFinite(timeMs)
      ) continue;

      const bucket = Math.floor(timeMs / bucketMs) * bucketMs;
      const key = `${deviceId}-${bucket}`;

      const current =
        grouped.get(key) || {
          timestamp,
          device: String(deviceId),
          deviceName: meterNames.get(deviceId) || `Device ${deviceId}`,
          L1: {},
          L2: {},
          L3: {},
        };

      if (
        new Date(timestamp).getTime() >
        new Date(current.timestamp).getTime()
      ) {
        current.timestamp = timestamp;
      }

      if (metricType === 6) current.L1 = { ...current.L1, P: value };
      if (metricType === 7) current.L2 = { ...current.L2, P: value };
      if (metricType === 8) current.L3 = { ...current.L3, P: value };

      grouped.set(key, current);
    }
  }

  return [...grouped.values()]
    .filter(
      row =>
        row.L1?.P !== undefined ||
        row.L2?.P !== undefined ||
        row.L3?.P !== undefined
    )
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() -
        new Date(b.timestamp).getTime()
    );
}

function parseBoatHistory(
  payload: SeriesResponse | SeriesItem[]
): BoatPosition[] {
  const devices = new Map<
    number,
    { latitudes: CoordinateSample[]; longitudes: CoordinateSample[] }
  >();

  for (const series of getSeriesItems(payload)) {
    for (const record of series.records || []) {
      const deviceId = Number(record[1]);
      const metricType = Number(record[2]);
      const time = new Date(record[3]).getTime();
      const value = Number(record[4]);

      if (
        !Number.isFinite(deviceId) ||
        !Number.isFinite(time) ||
        !Number.isFinite(value) ||
        (metricType !== LATITUDE_METRIC &&
          metricType !== LONGITUDE_METRIC)
      ) continue;

      if (!devices.has(deviceId)) {
        devices.set(deviceId, {
          latitudes: [],
          longitudes: [],
        });
      }

      const device = devices.get(deviceId)!;
      const sample = { time, value };

      if (metricType === LATITUDE_METRIC) {
        device.latitudes.push(sample);
      } else {
        device.longitudes.push(sample);
      }
    }
  }

  const positions: BoatPosition[] = [];

  devices.forEach((coordinates, deviceId) => {
    const latitudes = coordinates.latitudes.sort((a, b) => a.time - b.time);
    const longitudes = coordinates.longitudes.sort((a, b) => a.time - b.time);

    if (!latitudes.length || !longitudes.length) return;

    let longitudeIndex = 0;

    for (const latitude of latitudes) {
      while (
        longitudeIndex + 1 < longitudes.length &&
        Math.abs(longitudes[longitudeIndex + 1].time - latitude.time) <=
          Math.abs(longitudes[longitudeIndex].time - latitude.time)
      ) {
        longitudeIndex++;
      }

      const longitude = longitudes[longitudeIndex];

      if (
        Math.abs(longitude.time - latitude.time) >
        MAX_COORDINATE_SKEW_MS
      ) continue;

      const time = Math.max(latitude.time, longitude.time);

      positions.push({
        deviceId,
        time,
        timestamp: new Date(time).toISOString(),
        latitude: latitude.value,
        longitude: longitude.value,
      });
    }
  });

  return positions.sort((a, b) => a.time - b.time);
}

function findDataAtTime(
  energyData: EnergyData[],
  deviceId: number | null,
  selectedTime: Date,
  live: boolean
): EnergyData | null {
  if (deviceId === null) return null;

  const deviceData = energyData.filter(
    item => Number(item.device) === deviceId
  );

  if (!deviceData.length) return null;

  if (live) {
    return deviceData.reduce((latest, current) =>
      new Date(current.timestamp).getTime() >
      new Date(latest.timestamp).getTime()
        ? current
        : latest
    );
  }

  const target = selectedTime.getTime();

  return deviceData.reduce((closest, current) => {
    const currentDiff = Math.abs(
      new Date(current.timestamp).getTime() - target
    );

    const closestDiff = Math.abs(
      new Date(closest.timestamp).getTime() - target
    );

    return currentDiff < closestDiff ? current : closest;
  });
}

function mapBoatForDisplay(boat: Boat): BoatMapItem | null {
  const raw = boat as unknown as BoatApiMapData;

  const id = Number(raw.deviceId ?? raw.device ?? raw.id);
  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);

  if (
    !Number.isFinite(id) ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) return null;

  return {
    id,
    name: raw.name?.trim() || `Boat ${id}`,
    latitude,
    longitude,
    timestamp: raw.timestamp || raw.lastPositionAt,
    isInsideGeofence:
      raw.insidePortZone ?? raw.isInsideGeofence ?? false,
  };
}

function getHistoricalBoats(
  history: BoatPosition[],
  selectedTime: Date,
  names: Map<number, string>
): BoatMapItem[] {
  const target = selectedTime.getTime();
  const devices = new Map<number, BoatPosition[]>();

  history.forEach(position => {
    if (!devices.has(position.deviceId)) {
      devices.set(position.deviceId, []);
    }

    devices.get(position.deviceId)!.push(position);
  });

  const boats: BoatMapItem[] = [];

  devices.forEach((positions, deviceId) => {
    positions.sort((a, b) => a.time - b.time);

    const nextIndex = positions.findIndex(
      position => position.time >= target
    );

    const previous =
      nextIndex === -1
        ? positions[positions.length - 1]
        : nextIndex > 0
          ? positions[nextIndex - 1]
          : undefined;

    const next =
      nextIndex >= 0
        ? positions[nextIndex]
        : undefined;

    let latitude: number | undefined;
    let longitude: number | undefined;

    if (next?.time === target) {
      latitude = next.latitude;
      longitude = next.longitude;
    } else if (
      previous &&
      next &&
      next.time - previous.time <= MAX_INTERPOLATION_GAP_MS
    ) {
      const ratio =
        (target - previous.time) /
        (next.time - previous.time);

      latitude =
        previous.latitude +
        (next.latitude - previous.latitude) * ratio;

      longitude =
        previous.longitude +
        (next.longitude - previous.longitude) * ratio;
    } else {
      const candidates = [previous, next].filter(
        (position): position is BoatPosition => Boolean(position)
      );

      const nearest = candidates.sort(
        (a, b) =>
          Math.abs(a.time - target) -
          Math.abs(b.time - target)
      )[0];

      if (
        nearest &&
        Math.abs(nearest.time - target) <= MAX_NEAREST_POSITION_MS
      ) {
        latitude = nearest.latitude;
        longitude = nearest.longitude;
      }
    }

    if (
      latitude === undefined ||
      longitude === undefined
    ) return;

    boats.push({
      id: deviceId,
      name: names.get(deviceId) || `Boat ${deviceId}`,
      latitude,
      longitude,
      timestamp: selectedTime.toISOString(),
    });
  });

  return boats;
}

export default function PortMap() {
  const router = useRouter();
  const mapRef = useRef<MapRef>(null);

  const [mapStyle, setMapStyle] = useState(MAP_STYLE);
  const [hasTriedFallback, setHasTriedFallback] = useState(false);
  const [initialZoomCompleted, setInitialZoomCompleted] = useState(false);

  const [meters, setMeters] = useState<Meter[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] =
    useState<number | null>(null);

  const [energyData, setEnergyData] = useState<EnergyData[]>([]);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const [metersLoading, setMetersLoading] = useState(true);
  const [energyLoading, setEnergyLoading] = useState(false);

  const [boats, setBoats] = useState<Boat[]>([]);
  const [boatHistory, setBoatHistory] = useState<BoatPosition[]>([]);
  const [geofence, setGeofence] = useState<PortGeofence | null>(null);

  const getAuthHeaders = useCallback((): HeadersInit | null => {
    const token = authService.getToken();

    if (!token) {
      authService.logout();
      router.replace('/login');
      return null;
    }

    return {
      Accept: 'application/json',
      Authorization: `${authService.getTokenType()} ${token}`,
    };
  }, [router]);

  const handle401 = useCallback(
    (status: number) => {
      if (status !== 401) return false;

      authService.logout();
      router.replace('/login');
      return true;
    },
    [router]
  );

  const loadMeters = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      setMetersLoading(true);

      const response = await fetch(`${BACKEND_URL}/api/meters`, {
        headers,
        cache: 'no-store',
      });

      if (handle401(response.status)) return;
      if (!response.ok) {
        throw new Error(`Meters API ${response.status}`);
      }

      const data = (await response.json()) as Meter[];
      const sorted = [...data].sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      setMeters(sorted);

      setSelectedDeviceId(current => {
        if (
          current !== null &&
          sorted.some(meter => meter.id === current)
        ) {
          return current;
        }

        return (
          sorted.find(meter => meter.tags?.includes(EE_TAG_ID))?.id ??
          sorted[0]?.id ??
          null
        );
      });
    } catch (error) {
      console.error('Meters request error:', error);
    } finally {
      setMetersLoading(false);
    }
  }, [getAuthHeaders, handle401]);

  const loadEnergy = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers || !meters.length) return;

    try {
      setEnergyLoading(true);

      const end = new Date();
      const start = new Date(
        end.getTime() - MAP_HISTORY_HOURS * 60 * 60 * 1000
      );

      const payload = {
        start_dtm: start.toISOString(),
        end_dtm: end.toISOString(),
        series: [{
          sources: ['data_lake'],
          site: [...new Set(meters.map(meter => meter.idSite))],
          site_type: ['port'],
          device: meters.map(meter => meter.id),
          device_type: [],
          metric_type: [0],
          unit: [12],
          field: 'default',
        }],
      };

      const response = await fetch(
        `${BACKEND_URL}/api/series/data_lake`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (handle401(response.status)) return;
      if (!response.ok) {
        throw new Error(`Series API ${response.status}`);
      }

      const responseData = (await response.json()) as
        | SeriesResponse
        | SeriesItem[];

      const transformed = groupEnergyRecords(
        responseData,
        meters
      );

      setEnergyData(transformed);

      if (isLiveMode && transformed.length) {
        const latest = Math.max(
          ...transformed.map(item =>
            new Date(item.timestamp).getTime()
          )
        );

        setSelectedTime(new Date(latest));
      }
    } catch (error) {
      console.error('Energy request error:', error);
    } finally {
      setEnergyLoading(false);
    }
  }, [getAuthHeaders, handle401, isLiveMode, meters]);

  const loadBoats = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/boats`, {
        headers,
        cache: 'no-store',
      });

      if (handle401(response.status)) return;

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Boats API ${response.status}: ${body}`);
      }

      const data = (await response.json()) as BoatListResponse;
      setBoats(Array.isArray(data.boats) ? data.boats : []);
    } catch (error) {
      console.warn(
        '[MAP] Could not refresh boats:',
        error instanceof Error ? error.message : error
      );
    }
  }, [getAuthHeaders, handle401]);

  const loadBoatHistory = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      const end = new Date();
      const start = new Date(
        end.getTime() - MAP_HISTORY_HOURS * 60 * 60 * 1000
      );

      const payload = {
        start_dtm: start.toISOString(),
        end_dtm: end.toISOString(),
        series: [{
          sources: ['data_lake'],
          site: [3],
          site_type: ['port'],
          device: [],
          device_type: ['boat'],
          metric_type: [65, 66],
          unit: [0],
          field: 'default',
        }],
      };

      const response = await fetch(
        `${BACKEND_URL}/api/series/data_lake`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (handle401(response.status)) return;
      if (!response.ok) {
        throw new Error(`Boat history API ${response.status}`);
      }

      const data = (await response.json()) as
        | SeriesResponse
        | SeriesItem[];

      setBoatHistory(parseBoatHistory(data));
    } catch (error) {
      console.error('Boat history request error:', error);
    }
  }, [getAuthHeaders, handle401]);

  const loadGeofence = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/boats/geofence`,
        {
          headers,
          cache: 'no-store',
        }
      );

      if (handle401(response.status)) return;
      if (!response.ok) {
        throw new Error(`Geofence API ${response.status}`);
      }

      setGeofence((await response.json()) as PortGeofence);
    } catch (error) {
      console.error('Geofence request error:', error);
    }
  }, [getAuthHeaders, handle401]);

  useEffect(() => {
    void loadMeters();
    void loadBoats();
    void loadBoatHistory();
    void loadGeofence();
  }, [loadMeters, loadBoats, loadBoatHistory, loadGeofence]);

  useEffect(() => {
    if (!meters.length) return;

    void loadEnergy();

    const interval = setInterval(
      () => void loadEnergy(),
      ENERGY_REFRESH_MS
    );

    return () => clearInterval(interval);
  }, [loadEnergy, meters.length]);

  useEffect(() => {
    const interval = setInterval(
      () => void loadBoats(),
      BOAT_UI_REFRESH_MS
    );

    return () => clearInterval(interval);
  }, [loadBoats]);

  useEffect(() => {
    const interval = setInterval(
      () => void loadBoatHistory(),
      ENERGY_REFRESH_MS
    );

    return () => clearInterval(interval);
  }, [loadBoatHistory]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      map.jumpTo({
        center: [
          INITIAL_VIEW_STATE.longitude,
          INITIAL_VIEW_STATE.latitude,
        ],
        zoom: INITIAL_VIEW_STATE.zoom,
        pitch: INITIAL_VIEW_STATE.pitch,
        bearing: INITIAL_VIEW_STATE.bearing,
      });

      map.flyTo({
        center: [
          PORT_VIEW_STATE.longitude,
          PORT_VIEW_STATE.latitude,
        ],
        zoom: PORT_VIEW_STATE.zoom,
        pitch: PORT_VIEW_STATE.pitch,
        bearing: PORT_VIEW_STATE.bearing,
        duration: 6000,
        essential: true,
      });

      setTimeout(() => setInitialZoomCompleted(true), 6200);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isPlaying || selectedDeviceId === null) return;

    const futureTimes = energyData
      .filter(item => Number(item.device) === selectedDeviceId)
      .map(item => new Date(item.timestamp).getTime())
      .filter(time => time > selectedTime.getTime())
      .sort((a, b) => a - b);

    if (!futureTimes.length) {
      setIsPlaying(false);
      setIsLiveMode(true);
      return;
    }

    const timer = setTimeout(
      () => setSelectedTime(new Date(futureTimes[0])),
      500
    );

    return () => clearTimeout(timer);
  }, [energyData, isPlaying, selectedDeviceId, selectedTime]);

  const selectedData = useMemo(
    () =>
      findDataAtTime(
        energyData,
        selectedDeviceId,
        selectedTime,
        isLiveMode
      ),
    [energyData, selectedDeviceId, selectedTime, isLiveMode]
  );

  const activeDeviceIds = useMemo(
    () => new Set(energyData.map(item => Number(item.device))),
    [energyData]
  );

  const timeRange = useMemo(() => {
    if (!energyData.length) {
      const end = new Date();

      return {
        start: new Date(
          end.getTime() - MAP_HISTORY_HOURS * 60 * 60 * 1000
        ),
        end,
      };
    }

    const timestamps = energyData.map(item =>
      new Date(item.timestamp).getTime()
    );

    return {
      start: new Date(Math.min(...timestamps)),
      end: new Date(Math.max(...timestamps)),
    };
  }, [energyData]);

  const liveBoats = useMemo<BoatMapItem[]>(
    () =>
      boats
        .map(mapBoatForDisplay)
        .filter((boat): boat is BoatMapItem => boat !== null),
    [boats]
  );

  const boatNames = useMemo(
    () =>
      new Map(
        liveBoats.map(boat => [
          Number(boat.id),
          boat.name,
        ])
      ),
    [liveBoats]
  );

  const historicalBoats = useMemo(
    () =>
      getHistoricalBoats(
        boatHistory,
        selectedTime,
        boatNames
      ),
    [boatHistory, selectedTime, boatNames]
  );

  const displayedBoats =
    isLiveMode ? liveBoats : historicalBoats;

  const layers = useMemo(() => {
    const geofenceLayer = createGeofenceLayer(geofence);

    return [
      ...(geofenceLayer ? [geofenceLayer] : []),
      ...createBoatLayers(displayedBoats),
    ];
  }, [displayedBoats, geofence]);

  const handleTimeChange = (time: Date) => {
    setSelectedTime(time);
    setIsLiveMode(false);
    setIsPlaying(false);
  };

  const handlePlayPause = () => {
    setIsLiveMode(false);
    setIsPlaying(current => !current);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setIsLiveMode(true);

    const deviceData = energyData.filter(
      item => Number(item.device) === selectedDeviceId
    );

    if (!deviceData.length) return;

    const latest = Math.max(
      ...deviceData.map(item =>
        new Date(item.timestamp).getTime()
      )
    );

    setSelectedTime(new Date(latest));
  };

  return (
    <div className="relative h-full min-h-[calc(100vh-2rem)] w-full overflow-hidden rounded-xl">
      {initialZoomCompleted && (
        <>
          <MapSensorPanel
            meters={meters}
            selectedDeviceId={selectedDeviceId}
            selectedData={selectedData}
            activeDeviceIds={activeDeviceIds}
            isLoading={metersLoading || energyLoading}
            onDeviceChange={setSelectedDeviceId}
          />

          <TimeControls
            startTime={timeRange.start}
            endTime={timeRange.end}
            selectedTime={selectedTime}
            isLiveMode={isLiveMode}
            isPlaying={isPlaying}
            isLoading={metersLoading || energyLoading}
            hasData={energyData.length > 0}
            onTimeChange={handleTimeChange}
            onPlayPause={handlePlayPause}
            onReset={handleReset}
          />
        </>
      )}

      <MapGL
        ref={mapRef}
        initialViewState={INITIAL_VIEW_STATE}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        attributionControl={false}
        onError={() => {
          if (!hasTriedFallback && mapStyle.includes('openfreemap')) {
            setHasTriedFallback(true);
            setMapStyle(FALLBACK_MAP_STYLE);
          }
        }}
        onLoad={event => {
          try {
            add3DBuildings(event.target);
          } catch (error) {
            console.error('Could not add 3D buildings:', error);
          }
        }}
      >
        <DeckGLOverlay layers={layers} />
      </MapGL>
    </div>
  );
}