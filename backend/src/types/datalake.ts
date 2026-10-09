export type Range = 'hour' | 'day' | 'week' | 'month';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface Producer {
  _id?: string;
  id?: string;
  producerId?: string;
  username?: string;
  email?: string;
  name?: string;
  roles?: string[];
  devices?: Device[];
  groups?: Group[];
  [key: string]: unknown;
}

export interface Device {
  _id?: string;
  id?: string;
  deviceId?: string;
  name?: string;
  type?: string;
  source?: string;
  phases?: string[];
  [key: string]: unknown;
}

export interface Group {
  _id?: string;
  id?: string;
  groupId?: string;
  name?: string;
  devices?: unknown[];
  [key: string]: unknown;
}
