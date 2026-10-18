import type { Layer } from '@deck.gl/core';
import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import { TextLayer } from '@deck.gl/layers';

export type BoatMapItem = {
  id: number;
  name: string;
  longitude: number;
  latitude: number;
  timestamp?: string;
  isInsideGeofence?: boolean;
  heading?: number;
};

const BOAT_MODEL = '/models/cruise_ship.glb';

export function createBoatLayers(
  boats: BoatMapItem[]
): Layer[] {
  const validBoats = boats.filter(
    boat =>
      Number.isFinite(boat.longitude) &&
      Number.isFinite(boat.latitude)
  );

  const boatModels = new ScenegraphLayer<BoatMapItem>({
    id: 'boats-3d',
    data: validBoats,
    scenegraph: BOAT_MODEL,

    getPosition: boat => [
      boat.longitude,
      boat.latitude,
      2,
    ],

    getOrientation: boat => [
      0,
      -(boat.heading ?? 0),
      90,
    ],

    sizeScale: 0.01,

    pickable: true,

    _lighting: 'pbr',
  });

  const boatLabels = new TextLayer<BoatMapItem>({
    id: 'boats-labels',
    data: validBoats,

    getPosition: boat => [
      boat.longitude,
      boat.latitude,
      5,
    ],

    getText: boat =>
      boat.name || `Boat ${boat.id}`,

    getSize: 13,
    sizeUnits: 'pixels',

    getColor: () => [
      17,
      24,
      39,
      255,
    ],

    getBackgroundColor: () => [
      255,
      255,
      255,
      220,
    ],

    background: true,

    getTextAnchor: 'middle',
    getAlignmentBaseline: 'bottom',

    getPixelOffset: () => [
      0,
      -16,
    ],

    fontFamily: 'Arial, sans-serif',

    pickable: false,
  });

  return [
    boatModels,
    boatLabels,
  ];
}