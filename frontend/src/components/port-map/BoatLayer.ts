
import type {
  Layer,
  PickingInfo,
} from '@deck.gl/core';

import {
  ScenegraphLayer,
} from '@deck.gl/mesh-layers';

import {
  BOAT_MODELS,
  getBoatScale,
  getBoatVisualType,
  type BoatVisualType,
} from '../../config/boatVisuals';

export type BoatStatus =
  | 'Docked'
  | 'In Port'
  | 'Outside Port';

export type BoatMapItem = {
  id: number;
  name: string;
  longitude: number;
  latitude: number;
  length?: number | null;
  timestamp?: string;
  isInsideGeofence?: boolean;
  heading?: number;
  arrival?: string;
  status?: BoatStatus;
  quayId?: string;
  quayName?: string;
};

const PORT_HEADING = 75;
const MODEL_ROTATION_OFFSET = 180;

const MODEL_TYPES: BoatVisualType[] = [
  'ferry',
  'sail',
  'cruise',
];

export function createBoatLayers(
  boats: BoatMapItem[],
  onBoatClick?: (boat: BoatMapItem) => void
): Layer[] {
  const validBoats = boats.filter(
    boat =>
      Number.isFinite(boat.longitude) &&
      Number.isFinite(boat.latitude)
  );

  return MODEL_TYPES.map(type => {
    const modelBoats = validBoats.filter(
      boat =>
        getBoatVisualType(boat.name) === type
    );

    return new ScenegraphLayer<BoatMapItem>({
      id: `boats-3d-${type}`,

      data: modelBoats,

      scenegraph: BOAT_MODELS[type],

      getPosition: boat => [
        boat.longitude,
        boat.latitude,
        2,
      ],

      getOrientation: boat => [
        0,
        -(boat.heading ?? PORT_HEADING) +
          MODEL_ROTATION_OFFSET,
        90,
      ],

      getScale: boat => {
        const scale = getBoatScale(
          boat.name,
          boat.length
        );

        return [scale, scale, scale];
      },

      sizeScale: 1,

      pickable: true,
      autoHighlight: true,

      highlightColor: [
        59,
        130,
        246,
        100,
      ],

      _lighting: 'pbr',

      onClick: (
        info: PickingInfo<BoatMapItem>
      ) => {
        if (!info.object) {
          return;
        }

        onBoatClick?.(info.object);
      },

      updateTriggers: {
        getPosition: modelBoats.map(
          boat =>
            `${boat.id}-${boat.longitude}-${boat.latitude}`
        ),

        getOrientation: modelBoats.map(
          boat =>
            `${boat.id}-${boat.heading ?? PORT_HEADING}-${MODEL_ROTATION_OFFSET}`
        ),

        getScale: modelBoats.map(
          boat =>
            `${boat.id}-${boat.name}-${boat.length ?? 'unknown'}`
        ),
      },
    });
  });
}
