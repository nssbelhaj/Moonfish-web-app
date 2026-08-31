/**
 * Serveur Open-Meteo local.
 *
 * Sert des réponses à la forme EXACTE de l'API publique — tableaux parallèles,
 * horodatages `unixtime`, valeurs nulles éparses — pour pouvoir exercer le
 * pipeline complet (provider → score → pages) sans accès réseau sortant.
 *
 *   node scripts/open-meteo-stub.mjs 4000
 *   OPEN_METEO_MARINE_URL=http://127.0.0.1:4000/v1/marine \
 *   OPEN_METEO_FORECAST_URL=http://127.0.0.1:4000/v1/forecast \
 *   npm run build
 *
 * Ce n'est PAS un substitut à un test contre l'API réelle : il valide la forme
 * et le mapping, pas le contrat du fournisseur.
 */
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? 4000);
const HOUR = 3600;

function series(count, startEpoch, fn) {
  return Array.from({ length: count }, (_, i) => fn(startEpoch + i * HOUR, i));
}

function hoursFor(url) {
  const pastDays = Number(url.searchParams.get('past_days') ?? 0);
  const forecastDays = Number(url.searchParams.get('forecast_days') ?? 7);
  const startOfToday = Math.floor(Date.now() / 1000 / 86400) * 86400;
  const start = startOfToday - pastDays * 86400;
  return { start, count: (pastDays + forecastDays) * 24 };
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const lat = Number(url.searchParams.get('latitude') ?? 48);
  const lng = Number(url.searchParams.get('longitude') ?? -4);
  const { start, count } = hoursFor(url);
  const phase = Math.abs(lat * 7.3 + lng * 3.1);

  const wave = (t, i) => 0.9 + 0.75 * Math.sin((i + phase) / 9) + 0.35 * Math.sin((i + phase) / 31);
  const wind = (t, i) => Math.max(1, 16 + 12 * Math.sin((i + phase) / 11) + 6 * Math.sin((i + phase) / 37));

  const body =
    url.pathname === '/v1/marine'
      ? {
          latitude: lat,
          longitude: lng,
          timezone: 'GMT',
          hourly_units: { time: 'unixtime', wave_height: 'm', wave_period: 's', wave_direction: '°' },
          hourly: {
            time: series(count, start, (t) => t),
            wave_height: series(count, start, (t, i) => Math.max(0.1, Number(wave(t, i).toFixed(2)))),
            wave_period: series(count, start, (t, i) => Number((7 + 3 * Math.sin(i / 13)).toFixed(1))),
            wave_direction: series(count, start, (t, i) => Math.round((270 + 30 * Math.sin(i / 17) + 360) % 360)),
            // Une valeur sur onze est absente : le pipeline doit afficher « Indispo. ».
            sea_surface_temperature: series(count, start, (t, i) => (i % 11 === 0 ? null : Number((17 + 2 * Math.sin(i / 24)).toFixed(1)))),
          },
        }
      : {
          latitude: lat,
          longitude: lng,
          timezone: 'GMT',
          hourly_units: { time: 'unixtime', wind_speed_10m: 'km/h' },
          hourly: {
            time: series(count, start, (t) => t),
            wind_speed_10m: series(count, start, (t, i) => Number(wind(t, i).toFixed(1))),
            wind_direction_10m: series(count, start, (t, i) => Math.round((250 + 70 * Math.sin(i / 23) + 360) % 360)),
            wind_gusts_10m: series(count, start, (t, i) => Number((wind(t, i) * 1.4).toFixed(1))),
            temperature_2m: series(count, start, (t, i) => Number((17 + 5 * Math.sin((i - 6) / 24 * Math.PI * 2)).toFixed(1))),
            cloud_cover: series(count, start, (t, i) => Math.round(50 + 45 * Math.sin(i / 19))),
            pressure_msl: series(count, start, (t, i) => Math.round(1012 + 12 * Math.sin(i / 41))),
          },
        };

  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Stub Open-Meteo sur http://127.0.0.1:${port}`);
});
