'use client';

import { useCallback, useEffect, useState } from 'react';
import { energyDataService } from '../services/EnergyDataService';
import { Device, EnergyRange, EnergySample } from '../types/Device';

export function useEnergyData() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [range, setRange] = useState<EnergyRange>('day');
  const [samples, setSamples] = useState<EnergySample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const list = await energyDataService.getDevices();
      setDevices(list);
      setSelectedDevice(current => current || list[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally { setLoading(false); }
  }, []);

  const loadSamples = useCallback(async () => {
    if (!selectedDevice) { setSamples([]); return; }
    setLoading(true); setError(null);
    try {
      setSamples(await energyDataService.getDeviceAverage(selectedDevice, range));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load energy data');
    } finally { setLoading(false); }
  }, [selectedDevice, range]);

  useEffect(() => { loadDevices(); }, [loadDevices]);
  useEffect(() => { loadSamples(); }, [loadSamples]);

  return { devices, selectedDevice, setSelectedDevice, range, setRange, samples, loading, error, refresh: loadSamples };
}
