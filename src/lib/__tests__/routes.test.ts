import { describe, expect, it, vi } from 'vitest';
import { normalizeSiteUrl } from '../routes';

describe('normalizeSiteUrl', () => {
  /**
   * Régression : `metadataBase: new URL(SITE_URL)` levait au build sur une
   * valeur sans protocole. C'est la forme que Vercel expose lui-même dans
   * VERCEL_URL, et celle que tout le monde saisit à la main.
   */
  it('préfixe une valeur sans protocole plutôt que de casser', () => {
    expect(normalizeSiteUrl('moonfish-web-app.vercel.app')).toBe('https://moonfish-web-app.vercel.app');
  });

  it('conserve un protocole explicite', () => {
    expect(normalizeSiteUrl('https://moonfish.fish')).toBe('https://moonfish.fish');
    expect(normalizeSiteUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('retire la ou les barres finales', () => {
    expect(normalizeSiteUrl('https://moonfish.fish/')).toBe('https://moonfish.fish');
    expect(normalizeSiteUrl('https://moonfish.fish///')).toBe('https://moonfish.fish');
  });

  it('conserve un chemin de base, pour un déploiement en sous-répertoire', () => {
    expect(normalizeSiteUrl('https://exemple.fr/moonfish/')).toBe('https://exemple.fr/moonfish');
  });

  it('retombe sur le domaine par défaut si la variable est vide ou absente', () => {
    expect(normalizeSiteUrl(undefined)).toBe('https://moonfish.fish');
    expect(normalizeSiteUrl('')).toBe('https://moonfish.fish');
    expect(normalizeSiteUrl('   ')).toBe('https://moonfish.fish');
  });

  it('retombe sur le domaine par défaut sur une valeur illisible, sans lever', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(normalizeSiteUrl('https://')).toBe('https://moonfish.fish');
    expect(normalizeSiteUrl('::::')).toBe('https://moonfish.fish');
    warn.mockRestore();
  });

  it('produit toujours une valeur acceptée par new URL()', () => {
    for (const raw of ['moonfish.fish', 'https://a.b/', '::::', '', undefined, 'localhost:3000']) {
      expect(() => new URL(normalizeSiteUrl(raw))).not.toThrow();
    }
  });
});

/*
  ────────────────────────────────────────────────────────────────────────────
   Le repli est utile — il empêche le build d'échouer sur une valeur illisible.
   Mais utilisé faute de configuration, il produit un site en parfait état de
   marche qui se désigne sous une adresse qui n'est pas la sienne : sitemap,
   canonicals et aperçus de partage renvoient au domaine par défaut.

   Constaté sur un déploiement réel — HTTP 200, sitemap entièrement faux.
   D'où le fait que `normalizeSiteUrl` DOIT distinguer « rien de fourni » de
   « valeur fournie », même quand les deux mènent au même repli.
  ────────────────────────────────────────────────────────────────────────────
*/
describe('le repli sur le domaine par défaut est repérable', () => {
  it.each([undefined, null, '', '   '])(
    'une valeur vide (%p) mène au domaine de repli',
    (valeur) => {
      expect(normalizeSiteUrl(valeur)).toBe('https://moonfish.fish');
    },
  );

  it('un domaine fourni est respecté, protocole ou non', () => {
    for (const saisie of ['https://moonfish.nssbelhaj.com', 'moonfish.nssbelhaj.com']) {
      expect(normalizeSiteUrl(saisie)).toBe('https://moonfish.nssbelhaj.com');
    }
  });

  it('la barre finale est retirée : elle doublerait les séparateurs', () => {
    expect(normalizeSiteUrl('https://moonfish.nssbelhaj.com/')).toBe(
      'https://moonfish.nssbelhaj.com',
    );
  });
});
