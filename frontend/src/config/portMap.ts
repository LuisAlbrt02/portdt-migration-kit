export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
export const FALLBACK_MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

export const INITIAL_VIEW_STATE = {
  latitude: 32.74,
  longitude: -16.95,
  zoom: 10,
  pitch: 0,
  bearing: 0,
};

export const PORT_VIEW_STATE = {
  latitude: 32.64271,
  longitude: -16.90979,
  zoom: 16.4,
  pitch: 61.8,
  bearing: -53.1,
};

export const PORT_CENTER = {
  longitude: -16.91026503370738,
  latitude: 32.64184038298506,
};

export const PORT_LOCATIONS = [
  {
    id: 'main-dock',
    name: 'Main Dock',
    longitude: -16.910284,
    latitude: 32.641901,
    elevation: 0,
  },
];

export const PORT_DESTINATIONS = [
  { id: 'main-dock', name: 'Main Dock Energy Grid', longitude: -16.910284, latitude: 32.641901 },
  { id: 'crane-1', name: 'Port Crane System', longitude: -16.911741, latitude: 32.641808 },
  { id: 'shore-power', name: 'Shore Power Connection', longitude: -16.9094, latitude: 32.642 },
  { id: 'lighting-south', name: 'Port Lighting Grid', longitude: -16.914402, latitude: 32.641184 },
  { id: 'administrative', name: 'Administrative Buildings', longitude: -16.911058, latitude: 32.641813 },
  { id: 'fuel-station', name: 'Fuel Station Systems', longitude: -16.9088, latitude: 32.6418 },
];

//export const DEFAULT_BOAT_MODEL = '/models/standard/boat.gltf';
export const EE_TAG_ID = 1;
export const MAP_HISTORY_HOURS = 6;
export const ENERGY_REFRESH_MS = 60_000;
export const BOAT_UI_REFRESH_MS = 10_000;
