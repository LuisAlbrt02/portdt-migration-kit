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