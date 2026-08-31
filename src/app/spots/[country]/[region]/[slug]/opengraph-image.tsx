import { ImageResponse } from 'next/og';
import { BOTTOM_LABELS, EXPOSURE_LABELS } from '@/data/spots';
import { getSpotForecast, referenceNow } from '@/lib/forecast';
import { spots as spotRepository } from '@/lib/providers';
import { formatScore, litNotches, tierFor } from '@/lib/score-display';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Score surfcasting du spot, marée, vent et houle';

interface RouteParams {
  country: string;
  region: string;
  slug: string;
}

/** Les couleurs du handoff, en dur : l'image est rendue hors du DOM, sans variables CSS. */
const COLORS = {
  page: '#05100F',
  card: '#0A1A19',
  line: '#1E3439',
  ink: '#E8F2F0',
  muted: '#9FB4B3',
  dim: '#7E9494',
  bad: '#FF5A52',
  mid: '#FFB020',
  good: '#4FC3E8',
  best: '#2FE39A',
} as const;

/** Mêmes 12 chemins que la page : l'image est produite au build, pas à la demande. */
export async function generateStaticParams(): Promise<RouteParams[]> {
  const all = await spotRepository.list();
  return all.map((spot) => ({
    country: spot.countrySlug,
    region: spot.regionSlug,
    slug: spot.slug,
  }));
}

export default async function OpengraphImage({ params }: { params: RouteParams }) {
  const spot = await spotRepository.findByPath(params.country, params.region, params.slug);

  if (!spot) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: COLORS.page,
            color: COLORS.ink,
            fontSize: 56,
          }}
        >
          Moonfish
        </div>
      ),
      size,
    );
  }

  const forecast = await getSpotForecast(spot, referenceNow());
  const current = forecast.current;
  const value = current?.score.value ?? null;
  const tier = value === null ? null : tierFor(value);
  const isDanger = current?.score.safety.level === 'danger';
  const accent = isDanger ? COLORS.muted : (COLORS[tier?.tier ?? 'good'] as string);
  const lit = value === null ? 0 : litNotches(value);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: COLORS.page,
          padding: 64,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: COLORS.dim,
            }}
          >
            Moonfish · {spot.regionName}, {spot.countryName}
          </div>
          <div style={{ display: 'flex', fontSize: 76, color: COLORS.ink, marginTop: 12, fontWeight: 700 }}>
            {spot.name}
          </div>
          <div style={{ display: 'flex', fontSize: 26, color: COLORS.muted, marginTop: 10 }}>
            {EXPOSURE_LABELS[spot.exposure]} · fond de {BOTTOM_LABELS[spot.bottom].toLowerCase()}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span style={{ fontSize: 150, color: accent, fontWeight: 700, lineHeight: 1 }}>
                {formatScore(value)}
              </span>
              <span style={{ fontSize: 40, color: COLORS.dim, marginLeft: 10 }}>/10</span>
            </div>
            <div style={{ display: 'flex', fontSize: 28, color: COLORS.muted, marginTop: 8, letterSpacing: 3 }}>
              {isDanger ? 'CONDITIONS DANGEREUSES' : (tier?.label.toUpperCase() ?? 'INDISPONIBLE')}
            </div>
          </div>

          {/* La réglette à dix crans, comme dans l'interface. */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {Array.from({ length: 10 }, (_, index) => (
              <div
                key={index}
                style={{
                  width: 34,
                  height: 56,
                  background: index < lit ? accent : COLORS.line,
                }}
              />
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: `1px solid ${COLORS.line}`,
            paddingTop: 22,
            fontSize: 22,
            color: COLORS.dim,
          }}
        >
          <span>Marée · vent · houle · lune</span>
          <span style={{ color: COLORS.mid }}>DONNÉES DE DÉMONSTRATION</span>
        </div>
      </div>
    ),
    size,
  );
}
