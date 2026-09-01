import type {
  AccountExport,
  ContributionResult,
  ContributionsRepository,
  SpotContributions,
} from '../types';

const CLOSED_MESSAGE =
  'Les comptes ne sont pas ouverts sur ce déploiement. Aucune contribution ne peut être enregistrée.';

function closed<T>(): ContributionResult<T> {
  return { ok: false, reason: 'not-available', message: CLOSED_MESSAGE };
}

/**
 * Implémentation par défaut, quand aucun projet Supabase n'est configuré.
 *
 * Elle ne SIMULE rien. C'est la différence avec les fournisseurs de marée ou de
 * météo, qui ont un mode démonstration : une marée inventée reste une
 * illustration plausible du fonctionnement du site, tandis qu'un faux avis
 * signé d'un faux pêcheur serait un témoignage fabriqué. Sur une page qui
 * annonce « ce que les pêcheurs déclarent ici », c'est la seule chose qu'on ne
 * peut pas inventer.
 *
 * Les lectures rendent donc des listes vides, les écritures un refus explicite,
 * et l'interface affiche « pas encore ouvert » plutôt qu'un formulaire qui
 * échouerait.
 */
export class ClosedContributionsRepository implements ContributionsRepository {
  readonly available = false;

  readonly source = {
    name: 'Contributions — non ouvertes',
    kind: 'measured' as const,
    precision:
      'Aucun compte n’est configuré sur ce déploiement : ni avis, ni prise déclarée. Rien n’est simulé ici.',
  };

  async forSpot(_spotSlug: string): Promise<SpotContributions> {
    return { reviews: [], catches: [], averageRating: null, reviewCount: 0 };
  }

  async listForUser(_userId: string): Promise<{ reviews: []; catches: [] }> {
    return { reviews: [], catches: [] };
  }

  async getProfile(_userId: string): Promise<null> {
    return null;
  }

  async createProfile(): Promise<ContributionResult<never>> {
    return closed();
  }

  async renameProfile(): Promise<ContributionResult<never>> {
    return closed();
  }

  async saveReview(): Promise<ContributionResult<never>> {
    return closed();
  }

  async deleteReview(): Promise<ContributionResult<null>> {
    return closed();
  }

  async addCatch(): Promise<ContributionResult<never>> {
    return closed();
  }

  async deleteCatch(): Promise<ContributionResult<null>> {
    return closed();
  }

  async exportAccount(): Promise<ContributionResult<AccountExport>> {
    return closed();
  }

  async deleteAccount(): Promise<ContributionResult<null>> {
    return closed();
  }
}
