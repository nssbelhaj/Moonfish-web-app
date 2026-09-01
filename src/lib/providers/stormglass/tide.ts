import { tideEventSchema, type Spot, type TideEvent } from '@/data/schemas';
import {
  BREST_REFERENCE,
  coefficientAt,
  coefficientTable,
  type CoefficientPoint,
  type TideExtreme,
} from '@/lib/forecast/tide-coefficient';
import type { DateRange, SourceMeta, Sourced, TideProvider } from '../types';
import { stormglassErrorSchema, stormglassTideSchema } from './schemas';

const EXTREMES_URL = 'https://api.stormglass.io/v2/tide/extremes/point';

/**
 * Les prévisions de marée sont de l'astronomie : elles ne sont pas
 * réactualisées d'heure en heure comme un modèle météo. Les mettre en cache
 * vingt-quatre heures n'est donc pas un compromis, c'est la durée juste — et
 * c'est ce qui rend l'offre gratuite de Stormglass (dix appels par jour)
 * réellement utilisable.
 */
const DEFAULT_CACHE_SECONDS = 86_400;
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Couverture minimale exigée. Au-delà de J+3 la donnée passe derrière le mur
 * Pro ; en deçà, une prévision tronquée afficherait des journées vides sans
 * rien expliquer. Mieux vaut alors basculer franchement sur le repli.
 */
const MIN_COVERAGE_DAYS = 3;

export interface StormglassOptions {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  cacheSeconds?: number;
  timeoutMs?: number;
}

export class StormglassError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StormglassError';
  }
}

/**
 * Marées réelles, Stormglass.
 *
 * Deux appels par spot et par jour : celui du spot, et celui de BREST.
 *
 * Le second n'est pas une redondance. Stormglass donne des hauteurs et des
 * horaires, jamais le coefficient français — qui est défini comme le marnage de
 * Brest rapporté à son unité de hauteur. Le calculer depuis le marnage local
 * donnerait un nombre qui ne correspondrait à aucune table de marée française.
 * L'appel Brest est identique pour les douze spots, donc mutualisé par le cache :
 * il coûte un appel par jour au total, pas douze.
 */
export class StormglassTideProvider implements TideProvider {
  readonly source: SourceMeta = {
    name: 'Stormglass — modèle de marée',
    kind: 'forecast',
    precision:
      'Modèle global. Hauteurs au MLLW, proche du zéro des cartes françaises à quelques dizaines de centimètres près. Coefficient recalculé sur le marnage de Brest, définition SHOM. Pour une sortie réelle, la table du SHOM reste la référence.',
    url: 'https://stormglass.io',
  };

  private readonly options: Required<Omit<StormglassOptions, 'fetchImpl'>> & {
    fetchImpl: typeof fetch;
  };

  constructor(
    private readonly apiKey: string,
    options: StormglassOptions = {},
  ) {
    if (apiKey.trim().length === 0) {
      throw new StormglassError('Clé Stormglass absente : le fournisseur ne peut pas être construit.');
    }

    this.options = {
      fetchImpl: options.fetchImpl ?? fetch,
      baseUrl: options.baseUrl ?? EXTREMES_URL,
      cacheSeconds: options.cacheSeconds ?? DEFAULT_CACHE_SECONDS,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };
  }

  async getTideEvents(spot: Spot, range: DateRange): Promise<Sourced<TideEvent[]>> {
    const [spotExtremes, brestExtremes] = await Promise.all([
      this.fetchExtremes(spot.lat, spot.lng, range, spot.slug),
      this.fetchExtremes(BREST_REFERENCE.lat, BREST_REFERENCE.lng, range, 'brest'),
    ]);

    const table: CoefficientPoint[] = coefficientTable(brestExtremes);
    if (table.length === 0) {
      throw new StormglassError('Aucun coefficient calculable : extremums de Brest inexploitables.');
    }

    const events: TideEvent[] = [];

    for (const extreme of spotExtremes) {
      const time = new Date(extreme.time);
      if (Number.isNaN(time.getTime())) continue;
      if (time.getTime() < range.from.getTime() || time.getTime() >= range.to.getTime()) continue;

      const coefficient = coefficientAt(time, table);
      if (coefficient === null) continue;

      const parsed = tideEventSchema.safeParse({
        time: time.toISOString(),
        type: extreme.type,
        heightM: Math.round(extreme.heightM * 100) / 100,
        coefficient,
      });

      if (parsed.success) events.push(parsed.data);
    }

    this.assertCoverage(events, range, spot.slug);

    return {
      data: events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()),
      source: this.source,
      refreshedAt: new Date().toISOString(),
    };
  }

  /**
   * Une prévision tronquée afficherait des journées vides sans rien expliquer.
   * On exige donc que la partie gratuite du produit soit entièrement couverte,
   * quitte à basculer franchement sur le repli si elle ne l'est pas.
   */
  private assertCoverage(events: readonly TideEvent[], range: DateRange, label: string): void {
    if (events.length < 4) {
      throw new StormglassError(`Trop peu d'extremums renvoyés pour ${label}.`);
    }

    const required = range.from.getTime() + MIN_COVERAGE_DAYS * 86_400_000;
    const last = events.reduce(
      (max, event) => Math.max(max, new Date(event.time).getTime()),
      0,
    );

    if (last < required) {
      throw new StormglassError(
        `Couverture insuffisante pour ${label} : ${MIN_COVERAGE_DAYS} jours attendus au minimum.`,
      );
    }
  }

  private async fetchExtremes(
    lat: number,
    lng: number,
    range: DateRange,
    label: string,
  ): Promise<TideExtreme[]> {
    const url = new URL(this.options.baseUrl);
    url.searchParams.set('lat', lat.toFixed(4));
    url.searchParams.set('lng', lng.toFixed(4));
    url.searchParams.set('start', String(Math.floor(range.from.getTime() / 1000)));
    url.searchParams.set('end', String(Math.ceil(range.to.getTime() / 1000)));
    // Le MLLW est, parmi les zéros proposés, le plus proche du zéro des cartes
    // françaises. L'écart résiduel est annoncé dans `source.precision`.
    url.searchParams.set('datum', 'MLLW');

    let response: Response;

    try {
      response = await this.options.fetchImpl(url.toString(), {
        headers: { Authorization: this.apiKey, accept: 'application/json' },
        next: { revalidate: this.options.cacheSeconds },
        signal: AbortSignal.timeout(this.options.timeoutMs),
      } as RequestInit);
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new StormglassError(
        timedOut
          ? `Stormglass (${label}) n'a pas répondu en ${this.options.timeoutMs} ms.`
          : `Stormglass (${label}) injoignable.`,
        { cause: error },
      );
    }

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const parsed = stormglassErrorSchema.safeParse(payload);
      const reason = parsed.success ? JSON.stringify(parsed.data.errors) : `code ${response.status}`;
      throw new StormglassError(`Stormglass (${label}) a refusé la requête : ${reason}.`);
    }

    const body = stormglassTideSchema.parse(payload);

    // Le quota est journalisé : sur dix appels par jour, savoir où l'on en est
    // évite de découvrir la limite par une page vide.
    if (body.meta?.requestCount !== undefined && body.meta.dailyQuota !== undefined) {
      console.info(
        `[marées] Stormglass ${label} : ${body.meta.requestCount}/${body.meta.dailyQuota} appels aujourd'hui.`,
      );
    }

    return body.data.map((extreme) => ({
      time: extreme.time,
      heightM: extreme.height,
      type: extreme.type,
    }));
  }
}
