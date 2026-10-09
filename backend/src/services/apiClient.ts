import axios from 'axios';

export const API_BASE_URL =
  process.env.DATALAKE_API_URL ||
  'https://atlas.feelab.info/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
  },
});

export default apiClient;