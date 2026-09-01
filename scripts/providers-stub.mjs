/**
 * Serveur de fournisseurs local — Open-Meteo et Stormglass.
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
import { writeFileSync } from 'node:fs';

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

/** Période de l'onde semi-diurne lunaire M2, en secondes. */
const M2_PERIOD_S = 12.4206 * 3600;
const SYNODIC_S = 29.530588 * 86400;
const REFERENCE_NEW_MOON_S = Date.UTC(2000, 0, 6, 18, 14) / 1000;

/**
 * Marnage moyen d'un point.
 * Brest est calé sur sa valeur réelle (~5,5 m) : c'est le port de référence du
 * coefficient français, une valeur fantaisiste y rendrait tous les coefficients
 * de la démonstration absurdes.
 */
function meanRangeFor(lat, lng) {
  if (Math.abs(lat - 48.3833) < 0.01 && Math.abs(lng + 4.4944) < 0.01) return 5.5;
  const seed = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233)) * 43758.5453;
  return 1.5 + (seed % 1) * 6;
}

/** Extremums de marée : onde M2, amplitude suivant la lunaison. */
function tideExtremes(lat, lng, startS, endS) {
  const meanRange = meanRangeFor(lat, lng);
  const lagS = (Math.abs(Math.sin(lat * 3.1 + lng * 7.7)) % 1) * M2_PERIOD_S;
  const halfCycle = M2_PERIOD_S / 2;
  const data = [];

  const firstIndex = Math.floor((startS - lagS) / halfCycle);
  const lastIndex = Math.ceil((endS - lagS) / halfCycle);

  for (let i = firstIndex; i <= lastIndex; i += 1) {
    const t = lagS + i * halfCycle;
    if (t < startS || t > endS) continue;

    // Vives-eaux aux syzygies, avec le retard de deux jours de l'âge de la marée.
    const age = ((t - 2 * 86400 - REFERENCE_NEW_MOON_S) % SYNODIC_S + SYNODIC_S) % SYNODIC_S;
    const syzygy = Math.abs(Math.cos((2 * Math.PI * age) / SYNODIC_S));
    const range = meanRange * (0.5 + 0.75 * syzygy);
    const isHigh = ((i % 2) + 2) % 2 === 0;

    data.push({
      time: new Date(t * 1000).toISOString(),
      height: Number((meanRange * 0.9 + (isHigh ? range / 2 : -range / 2)).toFixed(2)),
      type: isHigh ? 'high' : 'low',
    });
  }

  return data;
}

/**
 * Compteur d'appels, pour mesurer la consommation de quota d'un build.
 *
 * Le palier gratuit de Stormglass est à dix appels par jour et le fournisseur
 * est ponctuel — une requête par spot. Savoir ce que coûte RÉELLEMENT un build
 * demande de compter, pas d'estimer : le cache de `fetch` de Next déduplique
 * une partie des appels, mais pas entre les workers de `next build`.
 *
 *   STUB_LOG=/tmp/calls.json node scripts/providers-stub.mjs 4000
 *
 * Le compteur vit en mémoire : relancer le stub entre deux mesures, sinon les
 * totaux s'additionnent silencieusement d'un build à l'autre.
 */
const seen = new Map();

function dumpLog() {
  const out = process.env.STUB_LOG;
  if (!out) return;
  writeFileSync(
    out,
    JSON.stringify([...seen.entries()].map(([url, hits]) => ({ url, hits })), null, 2),
  );
}

process.on('SIGTERM', dumpLog);
process.on('SIGINT', () => { dumpLog(); process.exit(0); });

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  if (process.env.STUB_LOG) {
    const key = url.pathname + '?' + url.searchParams.toString();
    seen.set(key, (seen.get(key) ?? 0) + 1);
    dumpLog();
  }

  if (url.pathname === '/v2/tide/extremes/point') {
    const lat = Number(url.searchParams.get('lat') ?? 48);
    const lng = Number(url.searchParams.get('lng') ?? -4);
    const startS = Number(url.searchParams.get('start') ?? Math.floor(Date.now() / 1000));
    const endS = Number(url.searchParams.get('end') ?? startS + 9 * 86400);

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        data: tideExtremes(lat, lng, startS, endS),
        meta: { datum: 'MLLW', requestCount: 1, dailyQuota: 10, cost: 1 },
      }),
    );
    return;
  }

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
