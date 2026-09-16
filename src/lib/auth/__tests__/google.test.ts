import { describe, expect, it } from 'vitest';

import { googleWarning } from '../config';

/**
 * `googleEnabled` exige aussi une base : il se teste en intégration. Ici, la
 * seule logique pure — l'avertissement quand une moitié manque.
 */
describe('la connexion Google', () => {
  it('ne dit rien quand rien n’est configuré : c’est facultatif', () => {
    expect(googleWarning({})).toBeNull();
  });

  it('ne dit rien quand les deux sont là', () => {
    expect(googleWarning({ AUTH_GOOGLE_ID: 'id', AUTH_GOOGLE_SECRET: 'secret' })).toBeNull();
  });

  it('nomme la moitié manquante — le bouton disparaîtrait sans un mot', () => {
    expect(googleWarning({ AUTH_GOOGLE_ID: 'id' })).toContain('AUTH_GOOGLE_SECRET manque');
    expect(googleWarning({ AUTH_GOOGLE_SECRET: 'secret' })).toContain('AUTH_GOOGLE_ID manque');
    // Une valeur vide compte comme absente.
    expect(googleWarning({ AUTH_GOOGLE_ID: 'id', AUTH_GOOGLE_SECRET: '  ' })).toContain('AUTH_GOOGLE_SECRET manque');
  });

  it('n’écrit jamais le secret dans l’avertissement', () => {
    expect(googleWarning({ AUTH_GOOGLE_SECRET: 'UnSecretTresVisible' })).not.toContain('UnSecretTresVisible');
  });
});
