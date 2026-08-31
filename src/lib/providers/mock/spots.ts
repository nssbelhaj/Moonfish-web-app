import { SPOTS } from '@/data/spots';
import type { Spot } from '@/data/schemas';
import type { SpotRepository } from '../types';

/**
 * Catalogue de spots en mémoire.
 *
 * ➜ POUR BRANCHER SUPABASE : créer `src/lib/providers/supabase/spots.ts`
 *   exposant le même `SpotRepository` (`select * from spots`, filtre sur
 *   `slug` / `country_slug` / `region_slug`), puis changer la ligne `spots:`
 *   de `src/lib/providers/index.ts`. Les pages n'ont aucune connaissance de
 *   l'origine des données.
 */
export class MockSpotRepository implements SpotRepository {
  readonly source = {
    name: 'Catalogue Moonfish',
    kind: 'measured' as const,
    precision: 'Coordonnées et caractéristiques relevées sur carte. Contenu éditorial, non simulé.',
  };

  async list(): Promise<Spot[]> {
    return [...SPOTS];
  }

  async findBySlug(slug: string): Promise<Spot | null> {
    return SPOTS.find((spot) => spot.slug === slug) ?? null;
  }

  async findByPath(countrySlug: string, regionSlug: string, slug: string): Promise<Spot | null> {
    return (
      SPOTS.find(
        (spot) =>
          spot.slug === slug &&
          spot.countrySlug === countrySlug &&
          spot.regionSlug === regionSlug,
      ) ?? null
    );
  }
}
