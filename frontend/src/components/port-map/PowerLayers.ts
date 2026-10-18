import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';

export type PowerNode = {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  powerKw?: number;
  isSelected?: boolean;
};

function getNodeColor(powerKw?: number, isSelected?: boolean): [number, number, number, number] {
  if (isSelected) return [37, 99, 235, 255];
  if (powerKw === undefined || Number.isNaN(powerKw)) return [107, 114, 128, 220];
  if (powerKw >= 1000) return [220, 38, 38, 230];
  if (powerKw >= 250) return [234, 179, 8, 230];
  return [34, 197, 94, 230];
}

export function createPowerLayers(nodes: PowerNode[]): Layer[] {
  const validNodes = nodes.filter(
    (node) =>
      Number.isFinite(node.longitude) &&
      Number.isFinite(node.latitude)
  );

  const points = new ScatterplotLayer<PowerNode>({
    id: 'power-nodes',
    data: validNodes,
    pickable: true,
    stroked: true,
    filled: true,
    radiusUnits: 'pixels',
    lineWidthUnits: 'pixels',
    getPosition: (d) => [d.longitude, d.latitude],
    getRadius: (d) => (d.isSelected ? 11 : 8),
    getLineWidth: (d) => (d.isSelected ? 3 : 2),
    getFillColor: (d) => getNodeColor(d.powerKw, d.isSelected),
    getLineColor: () => [255, 255, 255, 220],
    updateTriggers: {
      getFillColor: validNodes.map((d) => `${d.id}-${d.powerKw}-${d.isSelected}`),
      getRadius: validNodes.map((d) => `${d.id}-${d.isSelected}`),
    },
  });

  const labels = new TextLayer<PowerNode>({
    id: 'power-node-labels',
    data: validNodes,
    pickable: false,
    getPosition: (d) => [d.longitude, d.latitude],
    getText: (d) => d.name,
    getSize: 14,
    sizeUnits: 'pixels',
    getColor: () => [17, 24, 39, 255],
    getBackgroundColor: () => [255, 255, 255, 210],
    background: true,
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'bottom',
    getPixelOffset: () => [0, -14],
    fontFamily: 'Arial, sans-serif',
  });

  return [points, labels];
}