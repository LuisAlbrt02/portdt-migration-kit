export interface Device {
  id: string;
  name: string;
  type?: string;
  source?: string;
  phases?: string[];
  raw?: Record<string, unknown>;
}

export type EnergyRange = 'hour' | 'day' | 'week' | 'month';
export type EnergySample = Record<string, unknown> & { datetime?: string; timestamp?: string };
