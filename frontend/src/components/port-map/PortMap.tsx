'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Map as MapGL, type MapRef, NavigationControl, useControl } from 'react-map-gl/maplibre';
import type { DeckProps } from '@deck.gl/core';
import { MapLibreOverlay } from '@deck.gl/maplibre';
import { useRouter } from 'next/navigation';
import { authService } from '../../lib/Auth';
import type { EnergyData } from '../../types/EnergyData';
import type { Boat, BoatListResponse, PortGeofence } from '../../types/Boat';
import {
  BOAT_UI_REFRESH_MS, EE_TAG_ID, ENERGY_REFRESH_MS,
  FALLBACK_MAP_STYLE, INITIAL_VIEW_STATE, MAP_HISTORY_HOURS,
  MAP_STYLE, PORT_VIEW_STATE,
} from '../../config/portMap';
import {
  QUAY_ZONES,
  type QuayZone,
} from '../../config/quayZones';
import { add3DBuildings } from './BuildingsLayer';
import { createBoatLayers, type BoatMapItem, type BoatStatus } from './BoatLayer';
import { createGeofenceLayer } from './GeofenceLayer';
import { createQuayLayers } from './QuayLayer';
import MapSensorPanel from './MapSensorPanel';
import TimeControls from './TimeControls';
import { useTranslation } from '../../hooks/useTranslation';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
const LATITUDE_METRIC = 65;
const LONGITUDE_METRIC = 66;
const MAX_COORDINATE_SKEW_MS = 120_000;
const MAX_INTERPOLATION_GAP_MS = 5 * 60_000;
const MAX_NEAREST_POSITION_MS = 2 * 60_000;
const DOCKED_TIME_MS = 5 * 60_000;
const BOAT_HISTORY_HOURS = 24;
type InitialDataKey = 'meters' | 'energy' | 'boats' | 'history' | 'geofence';
type LoadState = 'loading' | 'ready' | 'error';
const INITIAL_DATA_KEYS: InitialDataKey[] = ['meters', 'energy', 'boats', 'history', 'geofence'];
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
  latitude?: number | string | null;
  longitude?: number | string | null;
  length?: number | null;
  boatType?: BoatMapItem['boatType'];
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
  const overlay = useControl<MapLibreOverlay>(() => new MapLibreOverlay(deckProps));
  overlay.setProps(deckProps);
  return null;
}
function getSeriesItems(payload: SeriesResponse | SeriesItem[]): SeriesItem[] {
  return Array.isArray(payload) ? payload : payload.series || payload.data || [];
}
function groupEnergyRecords(payload: SeriesResponse | SeriesItem[], meters: Meter[]): EnergyData[] {
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
      if (![deviceId, metricType, value, timeMs].every(Number.isFinite)) continue;
      const bucket = Math.floor(timeMs / bucketMs) * bucketMs;
      const key = `${deviceId}-${bucket}`;
      const current = grouped.get(key) || {
        timestamp,
        device: String(deviceId),
        deviceName: meterNames.get(deviceId) || `Device ${deviceId}`,
        L1: {}, L2: {}, L3: {},
      };
      if (new Date(timestamp).getTime() > new Date(current.timestamp).getTime()) {
        current.timestamp = timestamp;
      }
      if (metricType === 6) current.L1 = { ...current.L1, P: value };
      if (metricType === 7) current.L2 = { ...current.L2, P: value };
      if (metricType === 8) current.L3 = { ...current.L3, P: value };
      grouped.set(key, current);
    }
  }
  return [...grouped.values()]
    .filter(row => row.L1?.P !== undefined || row.L2?.P !== undefined || row.L3?.P !== undefined)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}
function parseBoatHistory(payload: SeriesResponse | SeriesItem[]): BoatPosition[] {
  const devices = new Map<number, {
    latitudes: CoordinateSample[];
    longitudes: CoordinateSample[];
  }>();
  for (const series of getSeriesItems(payload)) {
    for (const record of series.records || []) {
      const deviceId = Number(record[1]);
      const metricType = Number(record[2]);
      const time = new Date(record[3]).getTime();
      const value = Number(record[4]);
      if (
        !Number.isFinite(deviceId) || !Number.isFinite(time) ||
        !Number.isFinite(value) ||
        (metricType !== LATITUDE_METRIC && metricType !== LONGITUDE_METRIC)
      ) continue;
      if (!devices.has(deviceId)) devices.set(deviceId, { latitudes: [], longitudes: [] });
      const device = devices.get(deviceId)!;
      const sample = { time, value };
      if (metricType === LATITUDE_METRIC) device.latitudes.push(sample);
      else device.longitudes.push(sample);
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
      ) longitudeIndex++;
      const longitude = longitudes[longitudeIndex];
      if (Math.abs(longitude.time - latitude.time) > MAX_COORDINATE_SKEW_MS) continue;
      const time = Math.max(latitude.time, longitude.time);
      positions.push({
        deviceId, time, timestamp: new Date(time).toISOString(),
        latitude: latitude.value, longitude: longitude.value,
      });
    }
  });
  return positions.sort((a, b) => a.time - b.time);
}
function findDataAtTime(
  energyData: EnergyData[], deviceId: number | null,
  selectedTime: Date, live: boolean
): EnergyData | null {
  if (deviceId === null) return null;
  const deviceData = energyData.filter(item => Number(item.device) === deviceId);
  if (!deviceData.length) return null;
  if (live) {
    return deviceData.reduce((latest, current) =>
      new Date(current.timestamp).getTime() > new Date(latest.timestamp).getTime()
        ? current : latest
    );
  }
  const target = selectedTime.getTime();
  return deviceData.reduce((closest, current) => {
    const currentDiff = Math.abs(new Date(current.timestamp).getTime() - target);
    const closestDiff = Math.abs(new Date(closest.timestamp).getTime() - target);
    return currentDiff < closestDiff ? current : closest;
  });
}
function mapBoatForDisplay(boat: Boat): BoatMapItem | null {
  const raw = boat as unknown as BoatApiMapData;
  const id = Number(raw.deviceId ?? raw.device ?? raw.id);
  if (raw.latitude == null || raw.longitude == null) return null;
  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  if (![id, latitude, longitude].every(Number.isFinite)) return null;
  const length = typeof raw.length === 'number' &&
    Number.isFinite(raw.length) && raw.length > 0 ? raw.length : null;
  return {
    id,
    name: raw.name?.trim() || `Boat ${id}`,
    latitude,
    longitude,
    length,
    boatType: raw.boatType ?? null,
    timestamp: raw.timestamp || raw.lastPositionAt,
    isInsideGeofence: raw.insidePortZone ?? raw.isInsideGeofence ?? false,
  };
}
function calculateHeading(
  latitude1: number, longitude1: number,
  latitude2: number, longitude2: number
): number {
  const toRadians = (value: number) => value * Math.PI / 180;
  const toDegrees = (value: number) => value * 180 / Math.PI;
  const lat1 = toRadians(latitude1);
  const lat2 = toRadians(latitude2);
  const deltaLongitude = toRadians(longitude2 - longitude1);
  const y = Math.sin(deltaLongitude) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLongitude);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}
function getGeofencePolygon(geofence: PortGeofence | null): [number, number][] {
  if (!geofence) return [];
  const raw = geofence as unknown as {
    coordinates?: number[][][];
    geometry?: { coordinates?: number[][][] };
  };
  const coordinates = raw.geometry?.coordinates ?? raw.coordinates;
  if (!coordinates?.[0]) return [];
  return coordinates[0]
    .filter(point => Array.isArray(point) && point.length >= 2)
    .map(point => [Number(point[0]), Number(point[1])] as [number, number]);
}
function isPointInsidePolygon(
  longitude: number, latitude: number, polygon: [number, number][]
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
function getQuayForPoint(longitude: number, latitude: number): QuayZone | null {
  return QUAY_ZONES.find(zone =>
    isPointInsidePolygon(longitude, latitude, zone.coordinates)
  ) ?? null;
}
function getQuayHeading(quay: QuayZone): number {
  const [lon1, lat1] = quay.berthStart;
  const [lon2, lat2] = quay.berthEnd;
  return calculateHeading(lat1, lon1, lat2, lon2);
}
function distributeBoatsAtQuays(boats: BoatMapItem[]): BoatMapItem[] {
  const positions = new Map<number, { longitude: number; latitude: number; heading: number }>();
  for (const quay of QUAY_ZONES) {
    const assigned = boats.filter(boat => boat.quayId === quay.id).sort((a, b) => a.id - b.id);
    const heading = getQuayHeading(quay);
    const radians = (heading - 90) * Math.PI / 180;
    const offset = quay.berthOffsetMeters;
    assigned.forEach((boat, index) => {
      const ratio = (index + 1) / (assigned.length + 1);
      const longitude = quay.berthStart[0] + (quay.berthEnd[0] - quay.berthStart[0]) * ratio;
      const latitude = quay.berthStart[1] + (quay.berthEnd[1] - quay.berthStart[1]) * ratio;
      const adjustedLatitude = latitude + (offset * Math.cos(radians)) / 111320;
      const adjustedLongitude = longitude + (offset * Math.sin(radians)) / (111320 * Math.cos(latitude * Math.PI / 180));
      positions.set(boat.id, { longitude: adjustedLongitude, latitude: adjustedLatitude, heading });
    });
  }
  return boats.map(boat => {
    const position = positions.get(boat.id);
    return position ? { ...boat, ...position } : boat;
  });
}
function getQuayArrival(
  deviceId: number, quay: QuayZone,
  targetTime: number, history: BoatPosition[]
): string | undefined {
  const positions = history
    .filter(position => position.deviceId === deviceId && position.time <= targetTime)
    .sort((a, b) => a.time - b.time);
  if (!positions.length) return undefined;
  const lastIndex = positions.length - 1;
  const last = positions[lastIndex];
  if (
    targetTime - last.time > MAX_NEAREST_POSITION_MS ||
    !isPointInsidePolygon(last.longitude, last.latitude, quay.coordinates)
  ) return undefined;
  let firstInsideIndex = lastIndex;
  while (
    firstInsideIndex > 0 &&
    isPointInsidePolygon(
      positions[firstInsideIndex - 1].longitude,
      positions[firstInsideIndex - 1].latitude,
      quay.coordinates
    )
  ) firstInsideIndex--;
  if (firstInsideIndex === 0) return undefined;
  return positions[firstInsideIndex].timestamp;
}
function getBoatStatus(
  deviceId: number, latitude: number, longitude: number, targetTime: number,
  history: BoatPosition[], geofence: PortGeofence | null, quay: QuayZone | null
): BoatStatus {
  const portPolygon = getGeofencePolygon(geofence);
  if (!isPointInsidePolygon(longitude, latitude, portPolygon)) return 'Outside Port';
  if (!quay) return 'In Port';
  const cutoff = targetTime - DOCKED_TIME_MS;
  const positions = history
    .filter(position => position.deviceId === deviceId && position.time <= targetTime)
    .sort((a, b) => a.time - b.time);
  const anchor = [...positions].reverse().find(position => position.time <= cutoff);
  if (!anchor || cutoff - anchor.time > MAX_NEAREST_POSITION_MS) return 'In Port';
  const recent = positions.filter(position => position.time > cutoff && position.time <= targetTime);
  if (!recent.length) return 'In Port';
  if (targetTime - recent[recent.length - 1].time > MAX_NEAREST_POSITION_MS) return 'In Port';
  const samples = [anchor, ...recent];
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].time - samples[i - 1].time > MAX_NEAREST_POSITION_MS) return 'In Port';
  }
  const allInsideQuay = samples.every(position =>
    isPointInsidePolygon(position.longitude, position.latitude, quay.coordinates)
  );
  return allInsideQuay ? 'Docked' : 'In Port';
}
function getHistoricalBoats(
  history: BoatPosition[], selectedTime: Date,
  liveBoats: BoatMapItem[], geofence: PortGeofence | null
): BoatMapItem[] {
  const target = selectedTime.getTime();
  const metadata = new Map(liveBoats.map(boat => [boat.id, boat]));
  const devices = new Map<number, BoatPosition[]>();
  history.forEach(position => {
    if (!devices.has(position.deviceId)) devices.set(position.deviceId, []);
    devices.get(position.deviceId)!.push(position);
  });
  const boats: BoatMapItem[] = [];
  devices.forEach((positions, deviceId) => {
    positions.sort((a, b) => a.time - b.time);
    const nextIndex = positions.findIndex(position => position.time >= target);
    const previous = nextIndex === -1
      ? positions[positions.length - 1]
      : nextIndex > 0 ? positions[nextIndex - 1] : undefined;
    const next = nextIndex >= 0 ? positions[nextIndex] : undefined;
    let latitude: number | undefined;
    let longitude: number | undefined;
    let heading: number | undefined;
    if (next?.time === target) {
      latitude = next.latitude;
      longitude = next.longitude;
    } else if (
      previous && next &&
      next.time - previous.time <= MAX_INTERPOLATION_GAP_MS
    ) {
      const ratio = (target - previous.time) / (next.time - previous.time);
      latitude = previous.latitude + (next.latitude - previous.latitude) * ratio;
      longitude = previous.longitude + (next.longitude - previous.longitude) * ratio;
      heading = calculateHeading(
        previous.latitude, previous.longitude,
        next.latitude, next.longitude
      );
    } else {
      const nearest = [previous, next]
        .filter((position): position is BoatPosition => Boolean(position))
        .sort((a, b) =>
          Math.abs(a.time - target) - Math.abs(b.time - target)
        )[0];
      if (nearest && Math.abs(nearest.time - target) <= MAX_NEAREST_POSITION_MS) {
        latitude = nearest.latitude;
        longitude = nearest.longitude;
      }
    }
    if (latitude === undefined || longitude === undefined) return;
    const currentMetadata = metadata.get(deviceId);
    const quay = getQuayForPoint(longitude, latitude);
    const status = getBoatStatus(
      deviceId, latitude, longitude, target, history, geofence, quay
    );
    const arrival = quay
      ? getQuayArrival(deviceId, quay, target, history)
      : undefined;
    boats.push({
      id: deviceId,
      name: currentMetadata?.name || `Boat ${deviceId}`,
      length: currentMetadata?.length ?? null,
      boatType: currentMetadata?.boatType ?? null,
      latitude,
      longitude,
      heading,
      timestamp: selectedTime.toISOString(),
      status,
      isInsideGeofence: status !== 'Outside Port',
      quayId: quay?.id,
      quayName: quay?.name,
      arrival,
    });
  });
  return distributeBoatsAtQuays(boats);
}
function formatBoatDate(
  value: string | undefined, locale: string, fallback: string
): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date);
}
function formatQuayName(
  value: string | undefined, prefix: string
): string | undefined {
  if (!value) return undefined;
  const number = value.match(/\d+/)?.[0];
  return number ? `${prefix} ${number}` : value;
}
type PadDirection = 'up' | 'right' | 'down' | 'left';
function DirectionPadButton({ direction, label, onClick }: { direction: PadDirection; label: string; onClick: () => void }) {
  const rotations: Record<PadDirection, number> = { up: 0, right: 90, down: 180, left: 270 };
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className="flex h-10 w-10 items-center justify-center border-0 bg-transparent p-0 shadow-none transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-blue-600">
      <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
        <g transform={`rotate(${rotations[direction]} 50 50)`}>
          <path d="M50 12 C56 12 60 16 63 21 L83 58 C87 65 82 74 74 74 L26 74 C18 74 13 65 17 58 L37 21 C40 16 44 12 50 12Z" fill="#ffffff" stroke="#c0c0c0" />
        </g>
      </svg>
    </button>
  );
}
export default function PortMap() {
  const t = useTranslation();
  const router = useRouter();
  const mapRef = useRef<MapRef>(null);
  const boatCardRef = useRef<HTMLDivElement>(null);
  const [mapStyle, setMapStyle] = useState(MAP_STYLE);
  const [hasTriedFallback, setHasTriedFallback] = useState(false);
  const [initialZoomCompleted, setInitialZoomCompleted] = useState(false);
  const [flightStarted, setFlightStarted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapTimedOut, setMapTimedOut] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [initialData, setInitialData] = useState<Record<InitialDataKey, LoadState>>({
    meters: 'loading', energy: 'loading', boats: 'loading', history: 'loading', geofence: 'loading',
  });
  const markInitialData = useCallback((key: InitialDataKey, state: LoadState) => {
    setInitialData(current => current[key] === 'ready' ? current : { ...current, [key]: state });
  }, []);
  const allDataReady = INITIAL_DATA_KEYS.every(key => initialData[key] === 'ready');
  const initialError = INITIAL_DATA_KEYS.some(key => initialData[key] === 'error') || mapTimedOut;
  const readyToDisplay = allDataReady && mapReady && initialZoomCompleted;
  const [meters, setMeters] = useState<Meter[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [energyData, setEnergyData] = useState<EnergyData[]>([]);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [metersLoading, setMetersLoading] = useState(true);
  const [energyLoading, setEnergyLoading] = useState(false);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [boatHistory, setBoatHistory] = useState<BoatPosition[]>([]);
  const [geofence, setGeofence] = useState<PortGeofence | null>(null);
  const [selectedBoat, setSelectedBoat] = useState<BoatMapItem | null>(null);
  useEffect(() => {
    if (!selectedBoat) return;
    const handleClickOutside = (event: PointerEvent) => {
      if (boatCardRef.current && !boatCardRef.current.contains(event.target as Node)) {
        setSelectedBoat(null);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [selectedBoat]);
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
  const handle401 = useCallback((status: number) => {
    if (status !== 401) return false;
    authService.logout();
    router.replace('/login');
    return true;
  }, [router]);
  const loadMeters = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      setMetersLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/meters`, {
        headers, cache: 'no-store',
      });
      if (handle401(response.status)) return;
      if (!response.ok) throw new Error(`Meters API ${response.status}`);
      const data = await response.json() as Meter[];
      const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
      setMeters(sorted);
      markInitialData('meters', 'ready');
      setSelectedDeviceId(current => {
        if (current !== null && sorted.some(meter => meter.id === current)) return current;
        return sorted.find(meter => meter.tags?.includes(EE_TAG_ID))?.id ??
          sorted[0]?.id ?? null;
      });
    } catch (error) {
      console.error('Meters request error:', error);
      markInitialData('meters', 'error');
    } finally {
      setMetersLoading(false);
    }
  }, [getAuthHeaders, handle401, markInitialData]);
  const loadEnergy = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    if (!meters.length) { markInitialData('energy', 'ready'); return; }
    try {
      setEnergyLoading(true);
      const end = new Date();
      const start = new Date(end.getTime() - MAP_HISTORY_HOURS * 60 * 60 * 1000);
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
      const response = await fetch(`${BACKEND_URL}/api/series/data_lake`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (handle401(response.status)) return;
      if (!response.ok) throw new Error(`Series API ${response.status}`);
      const responseData = await response.json() as SeriesResponse | SeriesItem[];
      const transformed = groupEnergyRecords(responseData, meters);
      setEnergyData(transformed);
      markInitialData('energy', 'ready');
      if (isLiveMode && transformed.length) {
        const latest = Math.max(
          ...transformed.map(item => new Date(item.timestamp).getTime())
        );
        setSelectedTime(new Date(latest));
      }
    } catch (error) {
      console.error('Energy request error:', error);
      markInitialData('energy', 'error');
    } finally {
      setEnergyLoading(false);
    }
  }, [getAuthHeaders, handle401, isLiveMode, meters, markInitialData]);
  const loadBoats = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/boats`, {
        headers, cache: 'no-store',
      });
      if (handle401(response.status)) return;
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Boats API ${response.status}: ${body}`);
      }
      const data = await response.json() as BoatListResponse;
      setBoats(Array.isArray(data.boats) ? data.boats : []);
      markInitialData('boats', 'ready');
    } catch (error) {
      markInitialData('boats', 'error');
      console.warn(
        '[MAP] Could not refresh boats:',
        error instanceof Error ? error.message : error
      );
    }
  }, [getAuthHeaders, handle401, markInitialData]);
  const loadBoatHistory = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const end = new Date();
      const start = new Date(end.getTime() - BOAT_HISTORY_HOURS * 60 * 60 * 1000);
      const payload = {
        start_dtm: start.toISOString(),
        end_dtm: end.toISOString(),
        series: [{
          sources: ['data_lake'],
          site: [3],
          site_type: ['port'],
          device: [],
          device_type: ['boat'],
          metric_type: [LATITUDE_METRIC, LONGITUDE_METRIC],
          unit: [0],
          field: 'default',
        }],
      };
      const response = await fetch(`${BACKEND_URL}/api/series/data_lake`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (handle401(response.status)) return;
      if (!response.ok) throw new Error(`Boat history API ${response.status}`);
      const data = await response.json() as SeriesResponse | SeriesItem[];
      setBoatHistory(parseBoatHistory(data));
      markInitialData('history', 'ready');
    } catch (error) {
      console.error('Boat history request error:', error);
      markInitialData('history', 'error');
    }
  }, [getAuthHeaders, handle401, markInitialData]);
  const loadGeofence = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/boats/geofence`, {
        headers, cache: 'no-store',
      });
      if (handle401(response.status)) return;
      if (!response.ok) throw new Error(`Geofence API ${response.status}`);
      setGeofence(await response.json() as PortGeofence);
      markInitialData('geofence', 'ready');
    } catch (error) {
      console.error('Geofence request error:', error);
      markInitialData('geofence', 'error');
    }
  }, [getAuthHeaders, handle401, markInitialData]);
  useEffect(() => {
    void loadMeters();
    void loadBoats();
    void loadBoatHistory();
    void loadGeofence();
  }, [loadMeters, loadBoats, loadBoatHistory, loadGeofence, retryCount]);
  useEffect(() => {
    if (!meters.length) {
      if (initialData.meters === 'ready') markInitialData('energy', 'ready');
      return;
    }
    void loadEnergy();
    const interval = setInterval(() => void loadEnergy(), ENERGY_REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadEnergy, meters.length, retryCount, initialData.meters, markInitialData]);
  useEffect(() => {
    const interval = setInterval(() => void loadBoats(), BOAT_UI_REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadBoats]);
  useEffect(() => {
    const interval = setInterval(() => void loadBoatHistory(), ENERGY_REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadBoatHistory]);
  useEffect(() => {
    if (!allDataReady || !mapReady || flightStarted) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    setFlightStarted(true);
    map.flyTo({
      center: [PORT_VIEW_STATE.longitude, PORT_VIEW_STATE.latitude],
      zoom: PORT_VIEW_STATE.zoom,
      pitch: PORT_VIEW_STATE.pitch,
      bearing: PORT_VIEW_STATE.bearing,
      duration: 6000,
      essential: true,
    });
  }, [allDataReady, mapReady, flightStarted]);
  useEffect(() => {
    if (mapReady) return;
    const timeout = setTimeout(() => setMapTimedOut(true), 30000);
    return () => clearTimeout(timeout);
  }, [mapReady, retryCount]);
  const retryInitialLoad = () => {
    setInitialData({ meters: 'loading', energy: 'loading', boats: 'loading', history: 'loading', geofence: 'loading' });
    setMapTimedOut(false);
    setMapReady(false);
    setFlightStarted(false);
    setInitialZoomCompleted(false);
    setRetryCount(value => value + 1);
    const map = mapRef.current?.getMap();
    if (map?.isStyleLoaded() && map.areTilesLoaded() && !map.isMoving()) setMapReady(true);
  };
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
    const timer = setTimeout(() => setSelectedTime(new Date(futureTimes[0])), 500);
    return () => clearTimeout(timer);
  }, [energyData, isPlaying, selectedDeviceId, selectedTime]);
  const selectedData = useMemo(() =>
    findDataAtTime(energyData, selectedDeviceId, selectedTime, isLiveMode),
    [energyData, selectedDeviceId, selectedTime, isLiveMode]
  );
  const activeDeviceIds = useMemo(() =>
    new Set(energyData.map(item => Number(item.device))),
    [energyData]
  );
  const timeRange = useMemo(() => {
    if (!energyData.length) {
      const end = new Date();
      return {
        start: new Date(end.getTime() - MAP_HISTORY_HOURS * 60 * 60 * 1000),
        end,
      };
    }
    const timestamps = energyData.map(item => new Date(item.timestamp).getTime());
    return {
      start: new Date(Math.min(...timestamps)),
      end: new Date(Math.max(...timestamps)),
    };
  }, [energyData]);
  const liveBoats = useMemo<BoatMapItem[]>(() =>
    boats.map(mapBoatForDisplay).filter(
      (boat): boat is BoatMapItem => boat !== null
    ), [boats]
  );
  const liveBoatsWithStatus = useMemo(() =>
  distributeBoatsAtQuays(liveBoats.map(boat => {
    const timestamp = boat.timestamp
      ? new Date(boat.timestamp).getTime()
      : Date.now();
    const realLatitude = boat.latitude;
    const realLongitude = boat.longitude;
    const quay = getQuayForPoint(realLongitude, realLatitude);
    const status = getBoatStatus(
      boat.id, realLatitude, realLongitude,
      timestamp, boatHistory, geofence, quay
    );
    const arrival = quay
      ? getQuayArrival(boat.id, quay, timestamp, boatHistory)
      : undefined;
    return {
      ...boat,
      status,
      isInsideGeofence: status !== 'Outside Port',
      quayId: quay?.id,
      quayName: quay?.name,
      arrival,
    };
  })), [liveBoats, boatHistory, geofence]
  );
  const historicalBoats = useMemo(() =>
    getHistoricalBoats(boatHistory, selectedTime, liveBoats, geofence),
    [boatHistory, selectedTime, liveBoats, geofence]
  );
  const displayedBoats = isLiveMode ? liveBoatsWithStatus : historicalBoats;
  const layers = useMemo(() => {
    const geofenceLayer = createGeofenceLayer(geofence);
    return [
      ...(geofenceLayer ? [geofenceLayer] : []),
      ...createQuayLayers(QUAY_ZONES, t.quay),
      ...createBoatLayers(displayedBoats, setSelectedBoat),
    ];
  }, [displayedBoats, geofence, t.quay]);
  const handleTimeChange = (time: Date) => {
    setSelectedBoat(null);
    setSelectedTime(time);
    setIsLiveMode(false);
    setIsPlaying(false);
  };
  const handlePlayPause = () => {
    setSelectedBoat(null);
    setIsLiveMode(false);
    setIsPlaying(current => !current);
  };
  const handleReset = () => {
    setSelectedBoat(null);
    setIsPlaying(false);
    setIsLiveMode(true);
    const deviceData = energyData.filter(
      item => Number(item.device) === selectedDeviceId
    );
    if (!deviceData.length) return;
    const latest = Math.max(
      ...deviceData.map(item => new Date(item.timestamp).getTime())
    );
    setSelectedTime(new Date(latest));
  };
  const moveMap = (x: number, y: number) => {
    mapRef.current?.getMap().panBy([x, y], { duration: 350 });
  };
  return (
    <div className="relative h-full min-h-[calc(100vh-2rem)] w-full overflow-hidden rounded-xl">
      {readyToDisplay && (
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
      {readyToDisplay && selectedBoat && (
        <div
          ref={boatCardRef}
          className="absolute left-1/2 top-6 z-30 w-[340px] -translate-x-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <div className="bg-blue-600 px-4 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-200">
              {t.vessel}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-100">
              {selectedBoat.name}
            </h3>
          </div>
          <div className="space-y-4 px-3 py-3">
            <div className="flex items-center justify-between gap-5">
              <span className="text-base text-slate-500">{t.status}</span>
              <span className={`rounded-full px-2.5 py-1 text-base font-semibold ${
                selectedBoat.status === 'Docked'
                  ? 'bg-blue-50 text-blue-700'
                  : selectedBoat.status === 'In Port'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
              }`}>
                {selectedBoat.status === 'Docked'
                  ? t.docked
                  : selectedBoat.status === 'In Port'
                    ? t.inPort
                    : t.outsidePort}
              </span>
            </div>
            <div className="flex items-center justify-between gap-5">
              <span className="text-base text-slate-500">{t.quay}</span>
              <span className="text-right text-base font-semibold text-slate-900">
                {formatQuayName(selectedBoat.quayName, t.quay) ?? t.notAvailable}
              </span>
            </div>
            <div className="flex items-center justify-between gap-5">
              <span className="text-base text-slate-500">{t.arrival}</span>
              <span className="text-right text-base font-semibold text-slate-900">
                {formatBoatDate(selectedBoat.arrival, t.dateLocale, t.notAvailable)}
              </span>
            </div>
          </div>
        </div>
      )}
      {!flightStarted && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-slate-50 text-slate-800">
          {initialError ? (
            <>
              <p className="text-lg font-semibold">{t.mapLoadError}</p>
              <p className="max-w-md text-center text-sm text-slate-500">{t.mapLoadErrorDetails}</p>
              <button type="button" onClick={retryInitialLoad} className="rounded-lg bg-blue-600 px-5 py-2 font-medium hover:bg-blue-500">{t.retry}</button>
            </>
          ) : (
            <>
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" role="status" aria-label={t.loadingPortMap} />
              <p className="text-lg font-semibold">{t.loadingPortMap}</p>
              <p className="text-sm text-slate-500">{t.preparingPortData}</p>
            </>
          )}
        </div>
      )}
      <MapGL
        ref={mapRef}
        initialViewState={INITIAL_VIEW_STATE}
        style={{ width: '100%', height: '100%', visibility: flightStarted ? 'visible' : 'hidden' }}
        mapStyle={mapStyle}
        attributionControl={false}
        onError={() => {
          if (!hasTriedFallback && mapStyle.includes('openfreemap')) {
            setHasTriedFallback(true);
            setMapStyle(FALLBACK_MAP_STYLE);
          }
        }}
        onIdle={event => {
          if (!mapReady && event.target.isStyleLoaded() && event.target.areTilesLoaded()) setMapReady(true);
        }}
        onMoveEnd={() => {
          if (flightStarted && !initialZoomCompleted) setInitialZoomCompleted(true);
        }}
        onLoad={event => {
          try {
            add3DBuildings(event.target);
          } catch (error) {
            console.error('Could not add 3D buildings:', error);
          }
        }}
      >
        {readyToDisplay && <NavigationControl position="bottom-right" showZoom showCompass visualizePitch />}
        <DeckGLOverlay layers={layers} />
      </MapGL>
      {readyToDisplay && (
        <div className="absolute bottom-3 right-16 z-30 h-24 w-24" role="group" aria-label={t.mapPanControls}>
          <div className="absolute left-1/2 top-0 -translate-x-1/2"><DirectionPadButton direction="up" label={t.mapMoveUp} onClick={() => moveMap(0, -140)} /></div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2"><DirectionPadButton direction="right" label={t.mapMoveRight} onClick={() => moveMap(140, 0)} /></div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2"><DirectionPadButton direction="down" label={t.mapMoveDown} onClick={() => moveMap(0, 140)} /></div>
          <div className="absolute left-0 top-1/2 -translate-y-1/2"><DirectionPadButton direction="left" label={t.mapMoveLeft} onClick={() => moveMap(-140, 0)} /></div>
        </div>
      )}
    </div>
  );
}
