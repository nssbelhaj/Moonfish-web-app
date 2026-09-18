import { describe, expect, it } from 'vitest';

import { contributionsEnJson, priseDuCarnetEnJson, priseEnJson } from '@/lib/api/serialisation';

/**
 * Ce que l'API publie d'une contribution, et ce qu'elle en retient.
 *
 * Le risque est asymétrique : publier un champ de trop est irréversible — il
 * est parti chez tous les clients installés —, en publier un de moins se
 * corrige par une version suivante. Ces tests fixent donc la liste exacte des
 * champs, plutôt que de vérifier que les bons sont présents.
 */

const PRISE = {
  id: '11111111-1111-4111-8111-111111111111',
  spotSlug: 'pen-hat',
  userId: '22222222-2222-4222-8222-222222222222',
  authorName: 'Camille',
  species: 'Bar',
  lengthCm: 54,
  weightG: 1800,
  released: true,
  caughtAt: '2026-09-01T06:30:00.000Z',
  note: null,
  photoPath: '22222222-2222-4222-8222-222222222222/abc.jpg',
  visibility: 'publique' as const,
  createdAt: '2026-09-01T07:00:00.000Z',
};

const AVIS = {
  id: '33333333-3333-4333-8333-333333333333',
  spotSlug: 'pen-hat',
  userId: '22222222-2222-4222-8222-222222222222',
  authorName: 'Camille',
  rating: 4,
  comment: 'Belle descendante.',
  createdAt: '2026-09-01T07:00:00.000Z',
  updatedAt: '2026-09-01T07:00:00.000Z',
};

describe('l’identifiant de compte ne sort jamais', () => {
  it('est absent d’une prise publiée', () => {
    expect(Object.keys(priseEnJson(PRISE))).not.toContain('userId');
  });

  it('est absent d’un avis publié', () => {
    const json = contributionsEnJson({
      reviews: [AVIS],
      catches: [PRISE],
      averageRating: 4,
      reviewCount: 1,
    });

    /*
      Le nom affiché suffit à signer. Publier `userId` permettrait de recouper
      toutes les contributions d'une même personne à travers les quarante-deux
      spots — un profil que personne n'a demandé à constituer, et que la page
      de confidentialité ne prévoit pas.
    */
    expect(Object.keys(json.reviews[0]!)).not.toContain('userId');
    expect(Object.keys(json.catches[0]!)).not.toContain('userId');
  });

  it('est absent même du carnet, où pourtant la personne se lit elle-même', () => {
    // Elle sait déjà qui elle est : le lui renvoyer n'ajoute rien et ferait
    // voyager l'identifiant dans un cache de téléphone.
    expect(Object.keys(priseDuCarnetEnJson(PRISE))).not.toContain('userId');
  });
});

describe('le chemin de stockage devient une URL, et rien d’autre', () => {
  it('ne publie pas le chemin brut', () => {
    const json = priseEnJson(PRISE);

    expect(Object.keys(json)).not.toContain('photoPath');
    // Le chemin apprendrait comment les fichiers sont rangés sur le serveur.
    expect(JSON.stringify(json)).not.toContain('photoPath');
  });

  it('rend une URL ABSOLUE : une application n’a pas d’origine', () => {
    const json = priseEnJson(PRISE);

    expect(json.photoUrl).toMatch(/^https?:\/\//);
    expect(json.photoUrl).toContain('/api/photos/');
  });

  it('rend null quand il n’y a pas de photo, jamais une URL vide', () => {
    expect(priseEnJson({ ...PRISE, photoPath: null }).photoUrl).toBeNull();
  });
});

describe('la visibilité accompagne le carnet, jamais la vue publique', () => {
  it('est absente de la prise publiée', () => {
    expect(Object.keys(priseEnJson(PRISE))).not.toContain('visibility');
  });

  it('est présente dans le carnet, pour que le bouton « publier » sache son état', () => {
    expect(priseDuCarnetEnJson(PRISE).visibility).toBe('publique');
  });
});

describe('la note moyenne', () => {
  it('reste null quand il n’y a aucun avis', () => {
    const json = contributionsEnJson({
      reviews: [],
      catches: [],
      averageRating: null,
      reviewCount: 0,
    });

    // Jamais 0, qui se lirait comme une mauvaise note plutôt que comme une
    // absence d'avis.
    expect(json.averageRating).toBeNull();
    expect(json.reviewCount).toBe(0);
  });
});

describe('le résumé du carnet passe par la MÊME sérialisation que le reste', () => {
  it('ne laisse sortir ni userId ni photoPath par ses prises remarquables', async () => {
    /*
      ═══ LE DÉFAUT QUE CE TEST FIGE ═══

      `summarizeCatches` rend des objets du DOMAINE — avec `userId` et
      `photoPath`. Ils partaient tels quels dans `catchLog.longest`,
      `first` et `last`, alors que les trois autres listes de la même réponse
      passaient par `priseEnJson`. L'identifiant de compte et le chemin de
      stockage sortaient donc du serveur par cette seule porte, à côté de
      trois correctement fermées.

      Ce n'était pas une fuite entre personnes — c'est son propre carnet —
      mais une rupture du contrat annoncé, et la sorte de chose qui devient
      une vraie fuite le jour où quelqu'un réutilise le champ ailleurs. Il
      s'est vu en écrivant le schéma Zod du client mobile, qui attendait
      `photoUrl` et recevait `photoPath`.
    */
    const { carnetEnJson } = await import('@/lib/api/serialisation');
    const { summarizeCatches } = await import('@/lib/contributions/catch-log');

    const resume = carnetEnJson(summarizeCatches([{ ...PRISE, lengthCm: 54 }]));

    for (const [nom, prise] of [
      ['longest', resume.longest],
      ['first', resume.first],
      ['last', resume.last],
    ] as const) {
      expect(prise, `${nom} devrait porter la prise de l’essai`).not.toBeNull();
      expect(Object.keys(prise!), `${nom} publie userId`).not.toContain('userId');
      expect(Object.keys(prise!), `${nom} publie photoPath`).not.toContain('photoPath');
      expect(prise!.photoUrl, `${nom} sans URL absolue`).toMatch(/^https?:\/\//);
    }
  });

  it('garde les agrégats intacts — seules les prises sont resérialisées', async () => {
    const { carnetEnJson } = await import('@/lib/api/serialisation');
    const { summarizeCatches } = await import('@/lib/contributions/catch-log');

    const brut = summarizeCatches([PRISE]);
    const json = carnetEnJson(brut);

    expect(json.total).toBe(brut.total);
    expect(json.distinctSpecies).toBe(brut.distinctSpecies);
    expect(json.byMonth).toStrictEqual(brut.byMonth);
    // Douze mois, vides compris : une année creuse ne doit pas raccourcir la
    // série, sans quoi le graphique du carnet changerait d'échelle tout seul.
    expect(json.byMonth).toHaveLength(12);
  });
});
