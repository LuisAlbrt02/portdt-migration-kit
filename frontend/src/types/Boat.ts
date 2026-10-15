export type BoatZoneStatus = 'outside' | 'entering' | 'inside' | 'leaving' | 'stale';

export interface Boat {
  deviceId: number;
  name: string;
  mmsi?: string | null;
  siteId: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  status: BoatZoneStatus;
  insidePortZone: boolean;
  positionFresh: boolean;
  enteredAt?: string;
  exitedAt?: string;
}

export interface BoatListResponse {
  lastPollAt: string | null;
  boats: Boat[];
}

export interface PortGeofence {
  name: string;
  type: 'Polygon';
  coordinates: [number, number][][];
}
