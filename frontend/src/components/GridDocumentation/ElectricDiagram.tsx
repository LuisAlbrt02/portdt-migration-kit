'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Maximize2, X, ZoomIn, ZoomOut, Scan } from 'lucide-react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant,
  Controls, MiniMap, Panel, useReactFlow, useViewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { authService } from '../../lib/Auth';
import { useTranslation } from '../../hooks/useTranslation';
import {
  COLORS, VARIANTS, nodeTypes, edgeTypes, buildGraph,
  normalCircuits, emergencyCircuits, demonstratorEquipment,
  type BreakerData, type BusData, type EndPanelData,
} from './ElectricDiagram.config';

interface Meter {
  id: number;
  idSite: number;
  name: string;
  tags: number[];
  extra?: string | { friendlyName?: string } | null;
}

type SeriesRecord = [number, number, number, string, number];

interface SeriesItem {
  source: string;
  site: number;
  device: number;
  metric_type: number;
  records: SeriesRecord[];
}

interface SeriesResponse {
  start_dtm?: string | null;
  end_dtm?: string | null;
  series: SeriesItem[];
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
const ACTIVE_POWER_UNIT = 12;
const ACTIVE_POWER_METRICS = [6, 7, 8];
const DATA_WINDOW_MINUTES = 15;

function getMeterFriendlyName(meter: Meter): string | null {
  if (!meter.extra) return null;

  try {
    const extra = typeof meter.extra === 'string' ? JSON.parse(meter.extra) : meter.extra;
    return typeof extra?.friendlyName === 'string' && extra.friendlyName.trim()
      ? extra.friendlyName.trim()
      : null;
  } catch {
    return null;
  }
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPowerPayload(siteId: number) {
  const end = new Date();
  const start = new Date(end.getTime() - DATA_WINDOW_MINUTES * 60 * 1000);

  return {
    start_dtm: start.toISOString(),
    end_dtm: end.toISOString(),
    series: [
      {
        sources: ['data_lake'],
        site: [siteId],
        site_type: ['port'],
        device: [],
        device_type: ['meter'],
        metric_type: [0],
        unit: [ACTIVE_POWER_UNIT],
        field: 'default',
      },
    ],
  };
}

function buildDevicePowerMap(data: SeriesResponse, meters: Meter[]): Map<string, number> {
  const latestValues = new Map<number, Map<number, { timestamp: number; value: number }>>();

  data.series?.forEach((series) => {
    if (!ACTIVE_POWER_METRICS.includes(series.metric_type)) return;

    series.records?.forEach((record) => {
      const deviceId = record[1] ?? series.device;
      const metricType = record[2];
      const timestamp = new Date(record[3]).getTime();
      const value = record[4];

      if (!Number.isFinite(timestamp) || typeof value !== 'number' || !Number.isFinite(value)) return;

      let deviceMetrics = latestValues.get(deviceId);

      if (!deviceMetrics) {
        deviceMetrics = new Map();
        latestValues.set(deviceId, deviceMetrics);
      }

      const previous = deviceMetrics.get(metricType);

      if (!previous || timestamp > previous.timestamp) {
        deviceMetrics.set(metricType, { timestamp, value });
      }
    });
  });

  const result = new Map<string, number>();

  meters.forEach((meter) => {
    const metrics = latestValues.get(meter.id);
    if (!metrics) return;

    const powerW =
      (metrics.get(6)?.value || 0) +
      (metrics.get(7)?.value || 0) +
      (metrics.get(8)?.value || 0);

    const powerKW = Math.max(0, powerW / 1000);
    const friendlyName = getMeterFriendlyName(meter);

    result.set(meter.name, powerKW);

    if (friendlyName) {
      result.set(friendlyName, powerKW);
      result.set(`${meter.name} - ${friendlyName}`, powerKW);
    }
  });

  return result;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4.5;

function DiagramInner() {
  const t = useTranslation();
  const router = useRouter();
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  const [devicePowerMap, setDevicePowerMap] = useState<Map<string, number>>(new Map());
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);


  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      const token = authService.getToken();
      const tokenType = authService.getTokenType();

      if (!token) {
        authService.logout();
        router.replace('/login');
        return;
      }

      try {
        const meterResponse = await fetch(`${BACKEND_URL}/api/meters`, {
          headers: {
            Accept: 'application/json',
            Authorization: `${tokenType} ${token}`,
          },
          cache: 'no-store',
        });

        if (meterResponse.status === 401) {
          authService.logout();
          router.replace('/login');
          return;
        }

        if (!meterResponse.ok) {
          throw new Error(`Meters API ${meterResponse.status}`);
        }

        const meters = (await meterResponse.json()) as Meter[];
        const siteId = meters[0]?.idSite;

        if (siteId === undefined) {
          throw new Error('Port site could not be determined.');
        }

        const powerResponse = await fetch(`${BACKEND_URL}/api/series/data_lake`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `${tokenType} ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildPowerPayload(siteId)),
        });

        if (powerResponse.status === 401) {
          authService.logout();
          router.replace('/login');
          return;
        }

        if (!powerResponse.ok) {
          throw new Error(`Power API ${powerResponse.status}`);
        }

        const data = (await powerResponse.json()) as SeriesResponse;

        if (!cancelled) {
          setDevicePowerMap(buildDevicePowerMap(data, meters));
        }
      } catch (error) {
        console.error(
          'SHIFT2DC electrical diagram error:',
          error instanceof Error ? error.message : error
        );
      }
    };

    void loadData();
    const interval = window.setInterval(() => void loadData(), 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [router]);

  const getPower = useMemo(
    () => (deviceName?: string, panelName?: string) => {
      if (deviceName) {
        const value = devicePowerMap.get(deviceName);
        if (value !== undefined) return value;
      }

      if (panelName) {
        const value = devicePowerMap.get(panelName);
        if (value !== undefined) return value;

        const normalizedPanel = normalizeName(panelName);

        for (const [name, power] of devicePowerMap.entries()) {
          if (normalizeName(name).includes(normalizedPanel)) {
            return power;
          }
        }
      }

      return undefined;
    },
    [devicePowerMap],
  );

  const { nodes, edges } = useMemo(
    () => buildGraph(getPower, t),
    [getPower, t],
  );

  useEffect(() => {
    const id = window.setTimeout(
      () => void fitView({ duration: 300, padding: 0.05 }),
      50
    );

    return () => window.clearTimeout(id);
  }, [isFullscreen, fitView]);

  const legend = [
    { c: COLORS.normal, l: t.shift2dcNormal },
    { c: COLORS.emergency, l: t.shift2dcEmergency },
    { c: COLORS.demonstrator, l: t.shift2dcDemonstrator },
    { c: COLORS.main, l: t.shift2dcMain },
  ];

  const stats = [
    {
      label: 'QGED(N)',
      value: String(normalCircuits.length),
      desc: 'D1-D14',
      color: 'bg-orange-500',
      bg: 'bg-orange-50',
    },
    {
      label: 'QGED(E)',
      value: String(emergencyCircuits.length),
      desc: 'D15-D31',
      color: 'bg-green-500',
      bg: 'bg-green-50',
    },
    {
      label: t.shift2dcDemonstrator,
      value: String(demonstratorEquipment.length),
      desc: t.shift2dcEquipment,
      color: 'bg-cyan-500',
      bg: 'bg-cyan-50',
    },
    {
      label: 'Total',
      value: String(normalCircuits.length + emergencyCircuits.length),
      desc: t.shift2dcCircuitBreakers,
      color: 'bg-blue-500',
      bg: 'bg-blue-50',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-3 text-xl font-bold text-white">
              <span className="rounded-lg bg-blue-500/20 p-2">
                <Info className="h-5 w-5 text-blue-400" />
              </span>
              {t.shift2dcDiagramTitle}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void zoomOut({ duration: 150 })}
              disabled={zoom <= MIN_ZOOM}
              className="rounded-lg bg-slate-700 p-2.5 transition-colors hover:bg-slate-600 disabled:opacity-40"
            >
              <ZoomOut className="h-4 w-4 text-slate-300" />
            </button>

            <div className="min-w-[60px] rounded-lg bg-slate-700 px-3 py-1.5 text-center">
              <span className="text-sm text-slate-300">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            <button
              onClick={() => void zoomIn({ duration: 150 })}
              disabled={zoom >= MAX_ZOOM}
              className="rounded-lg bg-slate-700 p-2.5 transition-colors hover:bg-slate-600 disabled:opacity-40"
            >
              <ZoomIn className="h-4 w-4 text-slate-300" />
            </button>

            <div className="mx-1 h-6 w-px bg-slate-600" />

            <button
              onClick={() => void fitView({ duration: 300, padding: 0.05 })}
              className="rounded-lg bg-slate-700 p-2.5 hover:bg-slate-600"
              title="Fit"
            >
              <Scan className="h-4 w-4 text-slate-300" />
            </button>

            <button
              onClick={() => setIsFullscreen((value) => !value)}
              className="rounded-lg bg-slate-700 p-2.5 hover:bg-slate-600"
            >
              {isFullscreen ? (
                <X className="h-4 w-4 text-slate-300" />
              ) : (
                <Maximize2 className="h-4 w-4 text-slate-300" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`relative overflow-hidden rounded-xl border-2 border-slate-200 shadow-lg dark:border-slate-700 ${
          isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
        }`}
        style={{ height: isFullscreen ? '100vh' : '640px' }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.05 }}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ markerEnd: undefined }}
          onNodeClick={(_, node) => {
            if (node.type !== 'bus') {
              setSelectedComponent(node.id);
            }
          }}
          onPaneClick={() => setSelectedComponent(null)}
          style={{ background: '#f9fbfd' }}
        >
          <Background
            variant={BackgroundVariant.Lines}
            gap={60}
            lineWidth={0.5}
            color="#e2e8f0"
          />

          <Background
            id="dots"
            variant={BackgroundVariant.Dots}
            gap={15}
            size={1}
            color="#cbd5e1"
          />

          <Controls showInteractive={false} position="bottom-left" />

          <MiniMap
            pannable
            zoomable
            position="bottom-right"
            style={{ width: 220, height: 90 }}
            nodeStrokeWidth={2}
            nodeColor={(node) => {
              const data = node.data as Partial<BreakerData & BusData & EndPanelData>;

              if (data.color) return data.color;
              if (data.variant) return VARIANTS[data.variant].stroke;

              return '#94a3b8';
            }}
          />

          <Panel position="top-right">
            <div className="rounded-lg border border-slate-200 bg-white/95 p-3 text-xs shadow-md backdrop-blur">
              <div className="mb-2 font-bold text-slate-800">
                {t.shift2dcLegend}
              </div>

              <div className="space-y-1.5">
                {legend.map((item) => (
                  <div key={item.l} className="flex items-center gap-2 text-slate-700">
                    <span className="h-2 w-4 rounded-sm" style={{ background: item.c }} />
                    {item.l}
                  </div>
                ))}

                <div className="flex items-center gap-2 text-slate-700">
                  <span
                    className="w-4 border-t-2 border-dashed"
                    style={{ borderColor: COLORS.emergency }}
                  />
                  {t.shift2dcBackup}
                </div>
              </div>
            </div>
          </Panel>

          <Panel position="top-left">
            <div
              className="w-52 overflow-hidden rounded-lg border bg-white shadow-md"
              style={{ borderColor: COLORS.main }}
            >
              <div
                className="px-3 py-1 text-center text-xs font-bold text-white"
                style={{ background: COLORS.main }}
              >
                {t.shift2dcSingleLineDiagram}
              </div>

              <div className="px-3 py-2 text-center">
                <div className="text-[11px] font-semibold text-slate-800">
                  Funchal Port - SHIFT2DC
                </div>

                <div className="text-[10px] text-slate-500">
                  {t.shift2dcElectricalDistribution}
                </div>

                <div className="text-[10px] text-slate-400">
                  2026
                </div>
              </div>
            </div>
          </Panel>

          {selectedComponent && (
            <Panel position="top-center">
              <div className="w-64 rounded-xl border bg-white p-4 shadow-2xl dark:bg-slate-800">
                <div className="mb-2 flex items-start justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-white">
                    {selectedComponent}
                  </h4>

                  <button
                    onClick={() => setSelectedComponent(null)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t.shift2dcElectricalComponent}
                </p>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>
      
      {/*
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`${stat.bg} rounded-xl border border-slate-200 p-4`}
          >
            <div className="mb-1 flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${stat.color}`} />
              <span className="text-sm font-semibold text-slate-700">
                {stat.label}
              </span>
            </div>

            <div className="text-2xl font-bold text-slate-900">
              {stat.value}
            </div>

            <div className="text-xs text-slate-500">
              {stat.desc}
            </div>
          </div>
        ))}
      </div> */}
    </div>
  );
}

export default function ElectricalDiagram() {
  return (
    <ReactFlowProvider>
      <DiagramInner />
    </ReactFlowProvider>
  );
}
