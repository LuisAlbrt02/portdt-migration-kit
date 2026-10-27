
export type BoatType =
  | 'ferry'
  | 'sailing_ship'
  | 'cruise_ship'
  | 'yacht';

export interface BoatDevice {
  id: number;
  enabled: boolean;
  device_type: 'boat';
  idSite: number;
  name: string;
  remote_id?: string | null;
  extra?: string | null;
}

export interface BoatPosition {
  deviceId: number;
  name: string;
  mmsi?: string | null;
  siteId: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  length: number | null;
  boatType: BoatType | null;
}

export type BoatZoneStatus =
  | 'outside'
  | 'entering'
  | 'inside'
  | 'leaving'
  | 'stale';

export interface BoatMonitorState extends BoatPosition {
  status: BoatZoneStatus;
  insidePortZone: boolean;
  positionFresh: boolean;
  insideConfirmations: number;
  outsideConfirmations: number;
  enteredAt?: string;
  exitedAt?: string;
}

export interface BoatListResponse {
  lastPollAt: string | null;
  boats: BoatMonitorState[];
}

export interface GeofenceResponse {
  name: string;
  type: 'Polygon';
  coordinates: [number, number][][];
}

export interface AtlasSeriesItem {
  source?: string;
  site?: number;
  device?: number;
  metric_type?: number;
  records?: unknown[];
}
