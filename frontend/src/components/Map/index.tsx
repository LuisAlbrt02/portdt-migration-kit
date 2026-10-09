'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { Map } from 'react-map-gl/maplibre';

export default function MapVisualization() {
  return (
    <Map
      initialViewState={{ longitude: -16.91, latitude: 32.646, zoom: 14, pitch: 40, bearing: 0 }}
      mapStyle="https://tiles.openfreemap.org/styles/liberty"
      style={{ width: '100%', height: '100%' }}
      attributionControl
    />
  );
}
