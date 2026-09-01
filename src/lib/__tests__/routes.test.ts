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
