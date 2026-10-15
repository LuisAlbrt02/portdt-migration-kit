'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

import { Map as MapGL, type MapRef, useControl } from 'react-map-gl/maplibre';
import { MapLibreOverlay, type MapLibreOverlayProps} from '@deck.gl/maplibre';
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
import { createBoatLayers } from './BoatLayer';
import { createGeofenceLayer } from './GeofenceLayer';
import { createPowerLayers } from './PowerLayers';
import MapSensorPanel from './MapSensorPanel';
import TimeControls from './TimeControls';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

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

function DeckGLOverlay(
  props: MapLibreOverlayProps
) {
  const overlay = useControl<MapLibreOverlay>(
    () =>
      new MapLibreOverlay({
        ...props,
        interleaved: false,
      })
  );

  overlay.setProps(props);

  return null;
}

function getSeriesItems(payload: SeriesResponse | SeriesItem[]): SeriesItem[] {
  return Array.isArray(payload) ? payload : payload.series || payload.data || [];
}

function groupEnergyRecords(
  payload: SeriesResponse | SeriesItem[],
  meters: Meter[]
): EnergyData[] {
  const meterNames = new Map<number, string>(
    meters.map((meter) => [meter.id, meter.name])
  );

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
      ) {
        continue;
      }

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

      if (timeMs > new Date(current.timestamp).getTime()) {
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
      (row) =>
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

function findDataAtTime(
  energyData: EnergyData[],
  deviceId: number | null,
  selectedTime: Date,
  live: boolean
): EnergyData | null {
  if (deviceId === null) return null;

  const deviceData = energyData.filter(
    (item) => Number(item.device) === deviceId
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

export default function PortMap() {
  const router = useRouter();
  const mapRef = useRef<MapRef>(null);

  const [mapStyle, setMapStyle] = useState(MAP_STYLE);
  const [hasTriedFallback, setHasTriedFallback] = useState(false);

  const [meters, setMeters] = useState<Meter[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] =
    useState<number | null>(null);

  const [energyData, setEnergyData] = useState<EnergyData[]>([]);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const [metersLoading, setMetersLoading] = useState(true);
  const [energyLoading, setEnergyLoading] = useState(true);

  const [boats, setBoats] = useState<Boat[]>([]);
  const [geofence, setGeofence] = useState<PortGeofence | null>(null);
  const [animationTime, setAnimationTime] = useState(0);

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

    if (!headers) {
      setMetersLoading(false);
      setEnergyLoading(false);
      return;
    }

    try {
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

      setSelectedDeviceId((current) => {
        if (
          current !== null &&
          sorted.some((meter) => meter.id === current)
        ) {
          return current;
        }

        return (
          sorted.find((meter) =>
            meter.tags?.includes(EE_TAG_ID)
          )?.id ??
          sorted[0]?.id ??
          null
        );
      });

      if (!sorted.length) {
        setEnergyLoading(false);
      }
    } catch (error) {
      setEnergyLoading(false);
      throw error;
    } finally {
      setMetersLoading(false);
    }
  }, [getAuthHeaders, handle401]);

  const loadEnergy = useCallback(async () => {
    const headers = getAuthHeaders();

    if (!headers || !meters.length) {
      if (!metersLoading) {
        setEnergyLoading(false);
      }
      return;
    }

    try {
      const end = new Date();

      const start = new Date(
        end.getTime() -
        MAP_HISTORY_HOURS * 60 * 60 * 1000
      );

      const payload = {
        start_dtm: start.toISOString(),
        end_dtm: end.toISOString(),

        series: [
          {
            sources: ['data_lake'],
            site: [...new Set(meters.map((meter) => meter.idSite))],
            site_type: ['port'],
            device: meters.map((meter) => meter.id),
            device_type: [],
            metric_type: [0],
            unit: [12],
            field: 'default',
          },
        ],
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
          ...transformed.map((item) =>
            new Date(item.timestamp).getTime()
          )
        );

        setSelectedTime(new Date(latest));
      }
    } finally {
      setEnergyLoading(false);
    }
  }, [
    getAuthHeaders,
    handle401,
    isLiveMode,
    meters,
    metersLoading,
  ]);

  const loadBoats = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;

    const response = await fetch(`${BACKEND_URL}/api/boats`, {
      headers,
      cache: 'no-store',
    });

    if (handle401(response.status)) return;

    if (!response.ok) {
      throw new Error(`Boats API ${response.status}`);
    }

    const data = (await response.json()) as BoatListResponse;
    setBoats(data.boats);
  }, [getAuthHeaders, handle401]);

  const loadGeofence = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;

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

    setGeofence(
      (await response.json()) as PortGeofence
    );
  }, [getAuthHeaders, handle401]);

  useEffect(() => {
    void loadMeters().catch(console.error);
    void loadGeofence().catch(console.error);
  }, [loadMeters, loadGeofence]);

  useEffect(() => {
    if (!meters.length) return;

    void loadEnergy().catch(console.error);

    const interval = setInterval(
      () => void loadEnergy().catch(console.error),
      ENERGY_REFRESH_MS
    );

    return () => clearInterval(interval);
  }, [loadEnergy, meters.length]);

  useEffect(() => {
    void loadBoats().catch(console.error);

    const interval = setInterval(
      () => void loadBoats().catch(console.error),
      BOAT_UI_REFRESH_MS
    );

    return () => clearInterval(interval);
  }, [loadBoats]);

  useEffect(() => {
    let frame = 0;

    const animate = () => {
      setAnimationTime(performance.now() / 1000);
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, []);

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
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isPlaying || selectedDeviceId === null) return;

    const futureTimes = energyData
      .filter(
        (item) =>
          Number(item.device) === selectedDeviceId
      )
      .map((item) =>
        new Date(item.timestamp).getTime()
      )
      .filter(
        (time) =>
          time > selectedTime.getTime()
      )
      .sort((a, b) => a - b);

    if (!futureTimes.length) {
      setIsPlaying(false);
      setIsLiveMode(true);
      return;
    }

    const timer = setTimeout(() => {
      setSelectedTime(
        new Date(futureTimes[0])
      );
    }, 500);

    return () => clearTimeout(timer);
  }, [
    energyData,
    isPlaying,
    selectedDeviceId,
    selectedTime,
  ]);

  const selectedData = useMemo(
    () =>
      findDataAtTime(
        energyData,
        selectedDeviceId,
        selectedTime,
        isLiveMode
      ),
    [
      energyData,
      selectedDeviceId,
      selectedTime,
      isLiveMode,
    ]
  );

  const activeDeviceIds = useMemo(
    () =>
      new Set(
        energyData.map((item) =>
          Number(item.device)
        )
      ),
    [energyData]
  );

  const timeRange = useMemo(() => {
    if (!energyData.length) {
      const end = new Date();

      return {
        start: new Date(
          end.getTime() -
          MAP_HISTORY_HOURS * 60 * 60 * 1000
        ),
        end,
      };
    }

    const timestamps = energyData.map((item) =>
      new Date(item.timestamp).getTime()
    );

    return {
      start: new Date(
        Math.min(...timestamps)
      ),
      end: new Date(
        Math.max(...timestamps)
      ),
    };
  }, [energyData]);

  const layers = useMemo(() => {
    const geofenceLayer =
      createGeofenceLayer(geofence);

    return [
      ...(geofenceLayer
        ? [geofenceLayer]
        : []),

      ...createPowerLayers(
        selectedData,
        animationTime
      ),

      ...createBoatLayers(boats),
    ];
  }, [
    animationTime,
    boats,
    geofence,
    selectedData,
  ]);

  console.log('[MAP POWER DEBUG]', {
    energyRecords: energyData.length,
    selectedDeviceId,
    selectedData,
  });

  const handleTimeChange = (time: Date) => {
    setSelectedTime(time);
    setIsLiveMode(false);
    setIsPlaying(false);
  };

  const handlePlayPause = () => {
    setIsLiveMode(false);

    setIsPlaying(
      (current) => !current
    );
  };

  const handleReset = () => {
    setIsPlaying(false);
    setIsLiveMode(true);

    const deviceData = energyData.filter(
      (item) =>
        Number(item.device) ===
        selectedDeviceId
    );

    if (!deviceData.length) return;

    const latest = Math.max(
      ...deviceData.map((item) =>
        new Date(item.timestamp).getTime()
      )
    );

    setSelectedTime(
      new Date(latest)
    );
  };

  return (
    <div className="relative h-full min-h-[calc(100vh-2rem)] w-full overflow-hidden rounded-xl">

      {/* Always visible */}
      <MapSensorPanel
        meters={meters}
        selectedDeviceId={selectedDeviceId}
        selectedData={selectedData}
        activeDeviceIds={activeDeviceIds}
        isLoading={metersLoading || energyLoading}
        onDeviceChange={setSelectedDeviceId}
      />

      {/* Always visible */}
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

      <MapGL
        ref={mapRef}
        initialViewState={INITIAL_VIEW_STATE}
        style={{
          width: '100%',
          height: '100%',
        }}
        mapStyle={mapStyle}
        attributionControl={false}
        onError={() => {
          if (
            !hasTriedFallback &&
            mapStyle.includes('openfreemap')
          ) {
            setHasTriedFallback(true);
            setMapStyle(FALLBACK_MAP_STYLE);
          }
        }}
        onLoad={(event) => {
          try {
            add3DBuildings(event.target);
          } catch (error) {
            console.error(
              'Could not add 3D buildings:',
              error
            );
          }
        }}
      >
        <DeckGLOverlay layers={layers} />
      </MapGL>

    </div>
  );
}