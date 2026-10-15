import type {
  BoatMonitorState,
} from '../types/boat';

/**
 * Placeholder only.
 *
 * When the real port-light API / PLC interface is known,
 * replace the console.log with the real command.
 */
export async function handleBoatArrivalForLights(
  boat: BoatMonitorState
): Promise<void> {
  console.log(
    `[LIGHTS PLACEHOLDER] ${boat.name} entered the port zone. ` +
      `Device=${boat.deviceId}, MMSI=${boat.mmsi ?? 'n/a'}`
  );
}
