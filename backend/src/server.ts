import path from 'path';
import dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});

const app = require('./app').default;
const {
  startBoatGeofenceJob,
} = require('./jobs/boatGeofence.job');

const PORT = Number(process.env.PORT || 5001);

const server = app.listen(PORT, () => {
  console.log(`Port DT backend running on http://localhost:${PORT}`);

  startBoatGeofenceJob();
});

export default server;