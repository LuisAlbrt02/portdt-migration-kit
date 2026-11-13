import apiClient from './apiClient';

export interface Device {
  id: number;
  member_type: string;
  enabled: boolean;
  tags: number[];
  device_type: string;
  idSite: number | null;
  name: string;
  virtual: boolean;
  rules?: string | null;
  idSource?: number | null;
  source?: unknown;
  remote_id?: string | null;
  extra?: string | null;

  [key: string]: unknown;
}

export async function getDevices(
  authorization: string
): Promise<Device[]> {
  const response = await apiClient.get<Device[]>(
    '/devices',
    {
      headers: {
        Authorization: authorization,
      },
    }
  );

  return response.data;
}