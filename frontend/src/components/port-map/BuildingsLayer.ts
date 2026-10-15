import type { Map as MapLibreMap } from 'maplibre-gl';

export function add3DBuildings(map: MapLibreMap): void {
  if (map.getLayer('3d-buildings')) return;

  const style = map.getStyle();
  let sourceName = 'carto';

  if (style?.sources?.openmaptiles) sourceName = 'openmaptiles';
  else if (!style?.sources?.carto) {
    console.warn('No compatible building source found');
    return;
  }

  const firstSymbolLayer = style.layers?.find((layer) => layer.type === 'symbol')?.id;

  map.addLayer(
    {
      id: '3d-buildings',
      source: sourceName,
      'source-layer': 'building',
      filter: ['all', ['==', 'extrude', 'true']],
      type: 'fill-extrusion',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': [
          'interpolate',
          ['linear'],
          ['get', 'height'],
          0,
          '#e8e8e8',
          50,
          '#d4d4d4',
          100,
          '#c0c0c0',
        ],
        'fill-extrusion-height': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14,
          0,
          14.5,
          ['get', 'height'],
        ],
        'fill-extrusion-base': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14,
          0,
          14.5,
          ['get', 'min_height'],
        ],
        'fill-extrusion-opacity': 0.7,
      },
    },
    firstSymbolLayer
  );
}
