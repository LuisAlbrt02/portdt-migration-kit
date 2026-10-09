import apiClient from './apiClient';

export interface DataLakeSeries {
  sources: string[];
  site: number[];
  site_type: string[];
  device: number[];
  device_type: string[];
  metric_type: number[];
  unit: number[];
  field: string;
}

export interface DataLakeSeriesRequest {
  start_dtm: string;
  end_dtm: string;
  series: DataLakeSeries[];
}

export async function getDataLakeSeries(
  authorization: string,
  payload: DataLakeSeriesRequest
): Promise<unknown> {
  const response = await apiClient.post(
    '/series/data_lake',
    payload,
    {
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  );

  return response.data;
}