import type { Spot, TideEvent } from '@/data/schemas';
import { BREST_REFERENCE, type TideExtreme } from '@/lib/forecast/tide-coefficient';
import { FORECAST_DAYS } from '@/lib/forecast/slots';

import { assertCoverage, StormglassError, toTideEvents } from '../stormglass/tide';
import type { DateRange, SourceMeta, Sourced, TideProvider } from '../types';
import { POINT_BREST, type TableDeMaree, type TideTableStore } from './store';

/**
 * Le fournisseur de marées PERSISTANT.
 *
 * ─── Le problème ──────────────────────────────────────────────────────────
 *
 * Une marée est de l'astronomie : connue des semaines à l'avance, elle ne
 * change pas d'une heure à l'autre. Le site l'interrogeait pourtant comme une
 * météo — une requête par spot et par jour, dans un cache de `fetch` qui
 * mourait à chaque build et à chaque redéploiement. Sur un palier gratuit de
 * dix requêtes par jour, quarante-deux spots ne tenaient pas ; « réel » se
 * limitait à trois spots choisis à la main.
 *
 * ─── Le levier ────────────────────────────────────────────────────────────
 *
 * Demander une FENÊTRE de plusieurs jours, la CONSERVER en base, et ne
 * redemander qu'une fois la couverture insuffisante. Quarante-trois points
 * (42 spots + Brest), une fenêtre de deux semaines, une prévision de sept
 * jours : chaque point se rafraîchit tous les six ou sept jours, soit six ou
 * sept requêtes par jour. Le palier gratuit suffit.
 *
 * ─── Deux chemins, un budget ──────────────────────────────────────────────
 *
 * Au rendu d'une page, si la table couvre l'intervalle demandé, aucune
 * requête ne part — c'est le cas normal. Sinon le fournisseur est interrogé,
 * dans la limite d'un BUDGET journalier ; budget épuisé, l'erreur remonte et
 * le repli rend une marée simulée, annoncée comme telle. Jamais une marée
 * réelle tronquée.
 *
 * La tâche d'entretien, elle, rafraîchit À L'AVANCE les tables dont la
 * couverture devient juste, dans le même budget : en régime établi, c'est
 * elle qui fait tout le travail, et les pages ne demandent jamais rien.
 */

/** Jours demandés au fournisseur à chaque rafraîchissement. */
export const FENETRE_JOURS = 14;

/**
 * Couverture qu'une page exige : sept jours de prévision, plus la marge de
 * huit heures que `computeSpotForecast` ajoute de part et d'autre.
 */
export const HORIZON_REQUIS_MS = (FORECAST_DAYS + 1) * 86_400_000;

const JOUR_MS = 86_400_000;

export interface Fetcher {
  /** Une requête au fournisseur. Lève en cas d'échec. */
  extremes(lat: number, lng: number, range: DateRange, label: string): Promise<TideExtreme[]>;
  readonly source: SourceMeta;
}

export interface Budget {
  /** Réserve UNE requête. `false` si le budget du jour est épuisé. */
  reserver(): Promise<boolean>;
  /** Rend la réservation : la requête n'est jamais partie. */
  rendre(): Promise<void>;
}

/** Budget sans limite — pour les tests, ou un palier payant. */
export const BUDGET_ILLIMITE: Budget = {
  reserver: async () => true,
  rendre: async () => undefined,
};

export class BudgetEpuise extends Error {
  constructor(label: string) {
    super(`Budget Stormglass du jour épuisé : ${label} attendra le prochain rafraîchissement.`);
    this.name = 'BudgetEpuise';
  }
}

export interface BilanRafraichissement {
  /** Points rafraîchis, dans l'ordre. */
  rafraichis: string[];
  /** Points qui en avaient besoin mais n'ont pas pu l'être. */
  enAttente: string[];
  /** Points dont la couverture suffisait. */
  aJour: number;
  erreurs: { point: string; message: string }[];
}

/** Minuit UTC du jour de l'instant. */
function minuitUtc(instant: Date): Date {
  return new Date(Math.floor(instant.getTime() / JOUR_MS) * JOUR_MS);
}

/** La fenêtre à demander pour couvrir `range` : de la veille de son début à FENETRE_JOURS après. */
export function fenetreDeRequete(range: DateRange): DateRange {
  const from = new Date(minuitUtc(range.from).getTime() - JOUR_MS);
  return { from, to: new Date(from.getTime() + FENETRE_JOURS * JOUR_MS) };
}

/** Une table couvre-t-elle l'intervalle ? */
export function couvre(table: TableDeMaree | null, range: DateRange): table is TableDeMaree {
  if (table === null) return false;
  return (
    new Date(table.coversFrom).getTime() <= range.from.getTime() &&
    new Date(table.coversTo).getTime() >= range.to.getTime()
  );
}

export class PersistentTideProvider implements TideProvider {
  constructor(
    private readonly fetcher: Fetcher,
    private readonly store: TideTableStore,
    private readonly budget: Budget = BUDGET_ILLIMITE,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * La source du fournisseur, sans péremption.
   *
   * Le fournisseur direct annonce 72 h de validité : ce qui se dégradait,
   * c'était la COUVERTURE d'une table mise en cache. Ici la couverture est
   * garantie par construction — une table qui ne couvre plus n'est jamais
   * servie — et une marée demandée il y a six jours est aussi juste qu'hier.
   * Afficher « donnée ancienne » sur une astronomie exacte serait un faux
   * signal, et l'usure du vrai.
   */
  get source(): SourceMeta {
    return {
      ...this.fetcher.source,
      validityHours: null,
      precision: `${this.fetcher.source.precision} Table conservée en base et rafraîchie chaque semaine.`,
    };
  }

  async getTideEvents(spot: Spot, range: DateRange): Promise<Sourced<TideEvent[]>> {
    const brest = await this.tableDe(POINT_BREST, BREST_REFERENCE.lat, BREST_REFERENCE.lng, range);
    const duSpot = await this.tableDe(spot.slug, spot.lat, spot.lng, range);

    const events = toTideEvents(duSpot.extremes, brest.extremes, range);
    assertCoverage(events, range, spot.slug);

    return {
      data: events,
      source: this.source,
      // La date de la DONNÉE, pas celle du rendu : c'est ce que la puce de
      // fraîcheur affiche, et une table conservée cinq jours doit le dire.
      refreshedAt: duSpot.fetchedAt,
    };
  }

  /**
   * La table d'un point, lue en base si elle couvre l'intervalle, demandée
   * au fournisseur sinon — dans le budget.
   */
  private async tableDe(
    pointSlug: string,
    lat: number,
    lng: number,
    range: DateRange,
  ): Promise<TableDeMaree> {
    let existante: TableDeMaree | null;
    try {
      existante = await this.store.lire(pointSlug);
    } catch (error) {
      /*
        Le cas réel : le BUILD tourne avant le démarrage du serveur, donc
        avant les migrations — sur une base neuve, `tide_tables` n'existe pas
        encore. On ne va PAS interroger le fournisseur en direct pour autant :
        ce serait quarante-trois requêtes, le quota d'une semaine, pour des
        pages que la régénération horaire recalculera de toute façon une fois
        la table créée. On lève, le repli rend une marée simulée annoncée
        comme telle, et le journal dit pourquoi.
      */
      throw new StormglassError(
        `Table de marée illisible pour ${pointSlug} — les migrations ne sont probablement pas encore appliquées (build avant démarrage). Les pages se régénèrent d'elles-mêmes dans l'heure qui suit le démarrage.`,
        { cause: error },
      );
    }
    if (couvre(existante, range)) return existante;
    return this.rafraichirPoint(pointSlug, lat, lng, fenetreDeRequete(range), range);
  }

  /**
   * Demande la table au fournisseur, seul sur ce point.
   *
   * Sous le verrou, la table est RELUE : si un autre processus vient de
   * l'écrire et qu'elle couvre `requis`, on la rend sans requête. C'est ce
   * qui empêche un build à huit processus de demander huit fois Brest.
   */
  private rafraichirPoint(
    pointSlug: string,
    lat: number,
    lng: number,
    fenetre: DateRange,
    requis: DateRange,
  ): Promise<TableDeMaree> {
    return this.store.verrou(pointSlug, async () => {
      const relue = await this.store.lire(pointSlug);
      if (couvre(relue, requis)) return relue;
      return this.demander(pointSlug, lat, lng, fenetre);
    });
  }

  private async demander(
    pointSlug: string,
    lat: number,
    lng: number,
    fenetre: DateRange,
  ): Promise<TableDeMaree> {
    if (!(await this.budget.reserver())) throw new BudgetEpuise(pointSlug);

    let extremes: TideExtreme[];
    try {
      extremes = await this.fetcher.extremes(lat, lng, fenetre, pointSlug);
    } catch (error) {
      // Une requête qui n'a pas abouti n'a rien coûté au fournisseur : on
      // rend la réservation, sans quoi une panne réseau viderait le budget.
      await this.budget.rendre();
      throw error;
    }

    const instants = extremes
      .map((extreme) => new Date(extreme.time).getTime())
      .filter((t) => !Number.isNaN(t));

    if (instants.length < 4) {
      throw new StormglassError(`Trop peu d'extremums renvoyés pour ${pointSlug}.`);
    }

    const table: TableDeMaree = {
      pointSlug,
      // Bornes OBSERVÉES. Si le fournisseur a rendu moins que demandé, la
      // ligne le dit, et la couverture sera jugée sur ce qui existe.
      coversFrom: new Date(Math.min(...instants)).toISOString(),
      coversTo: new Date(Math.max(...instants)).toISOString(),
      extremes,
      sourceName: this.fetcher.source.name,
      fetchedAt: this.now().toISOString(),
    };

    await this.store.ecrire(table);
    return table;
  }

  /**
   * Rafraîchit à l'avance les tables dont la couverture devient juste.
   *
   * Brest d'abord, toujours : sans sa table, aucun coefficient n'est
   * calculable pour personne. Puis les points par couverture croissante — le
   * plus près de manquer en premier — jusqu'à `limite` requêtes ou budget
   * épuisé. Un point absent de la base compte comme une couverture nulle.
   */
  async rafraichir(spots: readonly Spot[], limite: number): Promise<BilanRafraichissement> {
    const maintenant = this.now();
    const requisJusqua = maintenant.getTime() + HORIZON_REQUIS_MS;
    const fenetre = fenetreDeRequete({
      from: maintenant,
      to: new Date(requisJusqua),
    });

    const points = [
      { slug: POINT_BREST, lat: BREST_REFERENCE.lat, lng: BREST_REFERENCE.lng },
      ...spots.map((spot) => ({ slug: spot.slug, lat: spot.lat, lng: spot.lng })),
    ];

    const tables = new Map((await this.store.toutes()).map((table) => [table.pointSlug, table]));

    const aFaire = points
      .map((point) => ({
        ...point,
        coversTo: tables.get(point.slug) ? new Date(tables.get(point.slug)!.coversTo).getTime() : 0,
      }))
      .filter((point) => point.coversTo < requisJusqua)
      .sort((a, b) => {
        if (a.slug === POINT_BREST) return -1;
        if (b.slug === POINT_BREST) return 1;
        return a.coversTo - b.coversTo;
      });

    const bilan: BilanRafraichissement = {
      rafraichis: [],
      enAttente: [],
      aJour: points.length - aFaire.length,
      erreurs: [],
    };

    for (const point of aFaire) {
      if (bilan.rafraichis.length >= limite) {
        bilan.enAttente.push(point.slug);
        continue;
      }
      try {
        await this.rafraichirPoint(point.slug, point.lat, point.lng, fenetre, {
          from: maintenant,
          to: new Date(requisJusqua),
        });
        bilan.rafraichis.push(point.slug);
      } catch (error) {
        bilan.enAttente.push(point.slug);
        bilan.erreurs.push({
          point: point.slug,
          message: error instanceof Error ? error.message : String(error),
        });
        // Budget épuisé : inutile d'essayer les suivants, ils échoueraient
        // pareil et chaque essai coûte une lecture.
        if (error instanceof BudgetEpuise) {
          bilan.enAttente.push(...aFaire.slice(aFaire.indexOf(point) + 1).map((p) => p.slug));
          break;
        }
      }
    }

    return bilan;
  }
}
