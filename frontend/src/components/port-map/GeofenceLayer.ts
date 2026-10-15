import { PolygonLayer } from '@deck.gl/layers';
import type { PortGeofence } from '../../types/Boat';

export function createGeofenceLayer(geofence: PortGeofence | null) {
  if (!geofence) return null;

  return new PolygonLayer({
    id: 'port-arrival-geofence',
    data: [{ polygon: geofence.coordinates[0] }],
    getPolygon: (item) => item.polygon,
    stroked: true,
    filled: true,
    extruded: false,
    lineWidthMinPixels: 2,
    getLineColor: [0, 170, 255, 230],
    getFillColor: [0, 170, 255, 28],
    pickable: false,
  });
}
