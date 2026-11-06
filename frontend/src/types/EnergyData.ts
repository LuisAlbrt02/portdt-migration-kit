export const EE_TAG_ID = 1;
export const ACTIVE_POWER_UNIT = 12;
export const POWER_FACTOR_UNIT = 15;
export const POWER_FACTOR_L1 = 19;
export const POWER_FACTOR_L2 = 20;
export const POWER_FACTOR_L3 = 21;

export interface PhaseData {
  P?: number;
  Q?: number;
  S?: number;
  V?: number;
  I?: number;
  PF?: number;
}

export interface EnergyData {
  _id?: string;
  timestamp: string;
  device: string;
  deviceName?: string;
  L1?: PhaseData;
  L2?: PhaseData;
  L3?: PhaseData;
  measure_cons?: number;
  L1_frequency?: number;
  producer?: string;
}