import type { Layer, PickingInfo } from '@deck.gl/core';
import { ScenegraphLayer } from '@deck.gl/mesh-layers';

export type BoatStatus =
  | 'Docked'
  | 'In Port'
  | 'Outside Port';

export type BoatMapItem = {
  id: number;
  name: string;
  longitude: number;
  latitude: number;
  timestamp?: string;
  isInsideGeofence?: boolean;
  heading?: number;
  arrival?: string;
  status?: BoatStatus;
  quayId?: string;
  quayName?: string;
};

const BOAT_MODEL = '/models/cruise_ship.glb';

const PORT_HEADING = 75;
const MODEL_ROTATION_OFFSET = 180;

export function createBoatLayers(
  boats: BoatMapItem[],
  onBoatClick?: (boat: BoatMapItem) => void
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
      -(boat.heading ?? PORT_HEADING) + MODEL_ROTATION_OFFSET,
      90,
    ],

    // Boat Size
    sizeScale: 0.01,

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
      if (!info.object) return;

      onBoatClick?.(
        info.object
      );
    },

    updateTriggers: {
      getPosition: validBoats.map(
        boat =>
          `${boat.id}-${boat.longitude}-${boat.latitude}`
      ),

      getOrientation: validBoats.map(
        boat =>
          `${boat.id}-${boat.heading ?? PORT_HEADING}-${MODEL_ROTATION_OFFSET}`
      ),
    },
  });

  return [
    boatModels,
  ];
}