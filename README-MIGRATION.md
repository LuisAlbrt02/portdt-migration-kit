# Port-DT migration kit

This kit replaces MongoDB/PostgreSQL/microservice access with one Express backend that proxies Enerspectrum.

Upstream base URL:
`https://atlas.feelab.info/api`

Implemented upstream paths:
- POST /login
- GET /producer
- GET /producer/device/:device_id/average/:range
- GET /producer/group/:group_id/average/:range
- GET /device/:device_id/samples/:range
- GET /device/:device_id/samples/average/:range

## Important
The supplied API document describes the endpoint paths but does not specify the exact JSON property containing the JWT returned by `/login`. `authController.ts` therefore accepts common names (`token`, `access_token`, `accessToken`, `jwt`). If the real response uses another field, change `extractToken()` after the first login test.

The producer/device response shapes may contain project-specific fields. `EnergyDataService.ts` intentionally accepts several common id/name shapes and keeps `raw` data.

## Apply
1. Back up the repo / create a git branch.
2. Delete items listed in `DELETE_THESE.txt`.
3. Copy the replacement files over the same paths.
4. Remove DeviceDataHealthNotification from `DashboardLayout.tsx` or set it permanently off.
5. Remove deleted links from `Sidebar.tsx` and cards from `app/page.tsx`.
6. Remove vessel-service imports/code from `components/Map/index.tsx` if keeping the port map.
7. Run `npm install` in backend and frontend so package-lock files are regenerated.
8. Run backend, then test login and `/api/auth/me` before adapting charts.

## Included frontend replacements
- `package.json` removes Socket.IO.
- `DashboardLayout.tsx` removes the MongoDB device-health notification.
- `Sidebar.tsx` removes Simulation, Converters, Ship Energy Prediction and PV Solar Model.
- `app/page.tsx` removes those dashboard cards.
- `components/Map/index.tsx` keeps a clean Port of Funchal map without vessel-energy simulation dependencies.
- `app/real-time/page.tsx` is intentionally generic at first: it displays the returned JSON fields so the real Enerspectrum payload can be confirmed before hard-coding chart field mappings.
