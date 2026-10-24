
export type BoatVisualType =
  | 'ferry'
  | 'sail'
  | 'cruise';

export const BOAT_MODELS: Record<
  BoatVisualType,
  string
> = {
  ferry: '/models/ferry.glb',
  sail: '/models/sailboat.glb',
  cruise: '/models/cruise_ship.glb',
};

const SAILBOATS = new Set([
  'ROYAL CLIPPER',
  'WIND SPIRIT',
  'WIND SURF',
  'CLUB MED 2',
]);

// Fixed scale for the ferry and sailboats
const FERRY_SCALE = 0.003;
const SAIL_SCALE = 0.003;

// Fixed scales based on cruise ship length
const CRUISE_SCALE = [
  { min: 100, max: 125, scale: 0.0050 },
  { min: 125, max: 150, scale: 0.0055 },
  { min: 150, max: 175, scale: 0.0060 },
  { min: 175, max: 200, scale: 0.0065 },
  { min: 200, max: 225, scale: 0.0070 },
  { min: 250, max: 275, scale: 0.0075 },
  { min: 275, max: 300, scale: 0.0085 },
  { min: 300, max: 325, scale: 0.0090 },
  { min: 325, max: 350, scale: 0.0095 },
  { min: 350, max: 375, scale: 0.0100 },

];

export function getBoatVisualType(
  name: string
): BoatVisualType {
  const normalizedName = name.trim().toUpperCase();

  if (normalizedName === 'LOBO MARINHO') {
    return 'ferry';
  }

  if (SAILBOATS.has(normalizedName)) {
    return 'sail';
  }

  return 'cruise';
}

export function getBoatScale(
  name: string,
  length?: number | null
): number {
  const type = getBoatVisualType(name);

  if (type === 'ferry') {
    return FERRY_SCALE;
  }

  if (type === 'sail') {
    return SAIL_SCALE;
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

  // Fallback for cruise ships outside configured ranges
  return validLength < 100
    ? CRUISE_SCALE[0].scale
    : CRUISE_SCALE[CRUISE_SCALE.length - 1].scale;
}
