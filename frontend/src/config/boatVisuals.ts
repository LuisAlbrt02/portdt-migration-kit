
export type BoatVisualType =
  | 'ferry'
  | 'sailing_ship'
  | 'cruise_ship'
  | 'yacht';

export const BOAT_MODELS: Record<BoatVisualType, string> = {
  ferry: '/models/ferry/scene.gltf',
  sailing_ship: '/models/sailship/scene.gltf',
  cruise_ship: '/models/cruise_ship/scene.gltf',
  yacht: '/models/yacht/scene.gltf',
};

// Fixed scales for special boat types
const FERRY_SCALE = 0.007;
const SAIL_SCALE = 0.003;
const YACHT_SCALE = 0.003;

// Cruise ship scales based on length
const CRUISE_SCALE = [
  { min: 100, max: 125, scale: 0.0055 },
  { min: 125, max: 150, scale: 0.0060 },
  { min: 150, max: 175, scale: 0.0065 },
  { min: 175, max: 200, scale: 0.0070 },
  { min: 200, max: 225, scale: 0.0075 },
  { min: 225, max: 250, scale: 0.0080 },
  { min: 250, max: 275, scale: 0.0085 },
  { min: 275, max: 300, scale: 0.0090 },
  { min: 300, max: 325, scale: 0.0095 },
  { min: 325, max: 350, scale: 0.0100 },
  { min: 350, max: 400, scale: 0.0110 },
];

export function getBoatVisualType(
  type?: string | null
): BoatVisualType {
  switch (type) {
    case 'ferry':
    case 'sailing_ship':
    case 'cruise_ship':
    case 'yacht':
      return type;

    default:
      return 'cruise_ship';
  }
}

export function getBoatScale(
  type?: string | null,
  length?: number | null
): number {
  const boatType = getBoatVisualType(type);

  if (boatType === 'ferry') {
    return FERRY_SCALE;
  }

  if (boatType === 'sailing_ship') {
    return SAIL_SCALE;
  }

  if (boatType === 'yacht') {
    return YACHT_SCALE;
  }

  const validLength =
    typeof length === 'number' &&
    Number.isFinite(length)
      ? length
      : 250;

  const group = CRUISE_SCALE.find(
    item =>
      validLength >= item.min &&
      validLength < item.max
  );

  if (group) {
    return group.scale;
  }

  return validLength < CRUISE_SCALE[0].min
    ? CRUISE_SCALE[0].scale
    : CRUISE_SCALE[CRUISE_SCALE.length - 1].scale;
}
