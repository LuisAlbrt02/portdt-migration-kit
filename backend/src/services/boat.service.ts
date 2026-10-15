import axios from 'axios';

import apiClient from './apiClient';
import { login } from './auth.service';

import type {
  AtlasSeriesItem,
  BoatDevice,
  BoatPosition,
} from '../types/boat';

let serviceAuthorization: string | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }

  return value;
}

function requireMetricType(name: string): number {
  const value = Number(requireEnv(name));

  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be numeric`);
  }

  return value;
}

async function getServiceAuthorization(
  forceRefresh = false
): Promise<string> {
  if (serviceAuthorization && !forceRefresh) {
    return serviceAuthorization;
  }

  const session = await login(
    requireEnv('DATALAKE_SERVICE_USERNAME'),
    requireEnv('DATALAKE_SERVICE_PASSWORD')
  );

  serviceAuthorization =
    `${session.token_type || 'bearer'} ${session.access_token}`;

  return serviceAuthorization;
}

async function withServiceAuthorization<T>(
  request: (authorization: string) => Promise<T>
): Promise<T> {
  try {
    return await request(
      await getServiceAuthorization()
    );
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401
    ) {
      serviceAuthorization = null;

      return request(
        await getServiceAuthorization(true)
      );
    }

    throw error;
  }
}

function extractSeriesItems(payload: unknown): AtlasSeriesItem[] {
  if (Array.isArray(payload)) {
    return payload as AtlasSeriesItem[];
  }

  if (payload && typeof payload === 'object') {
    const object = payload as {
      series?: AtlasSeriesItem[];
      data?: AtlasSeriesItem[];
    };

    if (Array.isArray(object.series)) {
      return object.series;
    }

    if (Array.isArray(object.data)) {
      return object.data;
    }
  }

  return [];
}

function extractBoatDevices(payload: unknown): BoatDevice[] {
  const rawItems = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === 'object' &&
        Array.isArray((payload as { data?: unknown[] }).data)
      ? (payload as { data: unknown[] }).data
      : [];

  return rawItems
    .filter(
      (item): item is BoatDevice =>
        !!item &&
        typeof item === 'object' &&
        (item as BoatDevice).device_type === 'boat'
    )
    .map((boat) => ({
      ...boat,
      id: Number(boat.id),
      idSite: Number(boat.idSite),
    }))
    .filter(
      (boat) =>
        Number.isFinite(boat.id) &&
        Number.isFinite(boat.idSite) &&
        boat.enabled !== false
    );
}

export async function getBoatDevices(): Promise<BoatDevice[]> {
  const path = requireEnv('DATALAKE_BOATS_PATH');

  return withServiceAuthorization(async (authorization) => {
    const response = await apiClient.get(path, {
      headers: {
        Authorization: authorization,
        Accept: 'application/json',
      },
    });

    return extractBoatDevices(response.data);
  });
}

type LatestMetric = {
  value: number;
  timestamp: string;
};

type CoordinatePair = {
  latitude?: LatestMetric;
  longitude?: LatestMetric;
};

function keepNewest(
  current: LatestMetric | undefined,
  candidate: LatestMetric
): LatestMetric {
  if (!current) {
    return candidate;
  }

  return new Date(candidate.timestamp).getTime() >
    new Date(current.timestamp).getTime()
    ? candidate
    : current;
}

export async function getLatestBoatPositions(): Promise<BoatPosition[]> {
  const boats = await getBoatDevices();

  if (boats.length === 0) {
    return [];
  }

  const latitudeMetricType = requireMetricType(
    'BOAT_LATITUDE_METRIC_TYPE'
  );

  const longitudeMetricType = requireMetricType(
    'BOAT_LONGITUDE_METRIC_TYPE'
  );

  const lookbackMinutes = Number(
    process.env.BOAT_POSITION_LOOKBACK_MINUTES || 10
  );

  const now = new Date();

  const start = new Date(
    now.getTime() - lookbackMinutes * 60_000
  );

  const deviceIds = boats.map((boat) => boat.id);

  const siteIds = [
    ...new Set(
      boats.map((boat) => boat.idSite)
    ),
  ];

  const payload = {
    start_dtm: start.toISOString(),
    end_dtm: now.toISOString(),
    series: [
      {
        sources: ['data_lake'],
        site: siteIds,
        site_type: ['port'],
        device: deviceIds,
        device_type: ['boat'],
        metric_type: [
          latitudeMetricType,
          longitudeMetricType,
        ],

        unit: [],

        field: 'default',
      },
    ],
  };

  const response = await withServiceAuthorization(
    (authorization) =>
      apiClient.post(
        '/series/data_lake',
        payload,
        {
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      )
  );

  const coordinatesByDevice =
    new Map<number, CoordinatePair>();

  for (const series of extractSeriesItems(response.data)) {
    for (const rawRecord of series.records || []) {
      if (!Array.isArray(rawRecord) || rawRecord.length < 5) {
        continue;
      }

      const deviceId = Number(rawRecord[1]);
      const metricType = Number(rawRecord[2]);
      const timestamp = String(rawRecord[3]);
      const value = Number(rawRecord[4]);

      if (
        !Number.isFinite(deviceId) ||
        !Number.isFinite(metricType) ||
        !Number.isFinite(value)
      ) {
        continue;
      }

      const current =
        coordinatesByDevice.get(deviceId) || {};

      const candidate: LatestMetric = {
        value,
        timestamp,
      };

      if (metricType === latitudeMetricType) {
        current.latitude = keepNewest(
          current.latitude,
          candidate
        );
      }

      if (metricType === longitudeMetricType) {
        current.longitude = keepNewest(
          current.longitude,
          candidate
        );
      }

      coordinatesByDevice.set(deviceId, current);
    }
  }

  const boatsById = new Map(
    boats.map((boat) => [boat.id, boat])
  );

  const maxSkewMs = Number(
    process.env.BOAT_COORDINATE_PAIR_MAX_SKEW_MS ||
      120_000
  );

  const result: BoatPosition[] = [];

  for (const [deviceId, coordinates] of coordinatesByDevice) {
    const boat = boatsById.get(deviceId);

    if (
      !boat ||
      !coordinates.latitude ||
      !coordinates.longitude
    ) {
      continue;
    }

    const latitudeTime = new Date(
      coordinates.latitude.timestamp
    ).getTime();

    const longitudeTime = new Date(
      coordinates.longitude.timestamp
    ).getTime();

    if (
      Math.abs(latitudeTime - longitudeTime) >
      maxSkewMs
    ) {
      console.warn(
        `[BOAT] ${boat.name}: latitude/longitude timestamps are too far apart`
      );

      continue;
    }

    result.push({
      deviceId: boat.id,
      name: boat.name,
      mmsi: boat.remote_id,
      siteId: boat.idSite,
      latitude: coordinates.latitude.value,
      longitude: coordinates.longitude.value,
      timestamp:
        latitudeTime >= longitudeTime
          ? coordinates.latitude.timestamp
          : coordinates.longitude.timestamp,
    });
  }

  return result;
}
