import apiClient from './apiClient';

export interface Meter {
  id: number;
  member_type: string;
  enabled: boolean;
  tags: number[];
  device_type: string;
  idSite: number;
  name: string;
  virtual: boolean;
  rules?: string | null;
  idSource?: number | null;
  source?: unknown;
  remote_id?: string | null;
  extra?: string | null;

  [key: string]: unknown;
}

export async function getMeters(
  authorization: string
): Promise<Meter[]> {
  const response = await apiClient.get<Meter[]>(
    '/meters',
    {
      headers: {
        Authorization: authorization,
      },
    }
  );

  return response.data;
}