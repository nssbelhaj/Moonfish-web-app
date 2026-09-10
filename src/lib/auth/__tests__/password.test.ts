import { describe, expect, it } from 'vitest';

import { besoinDeRehachage, hacher, verifier } from '../password';

/*
  ────────────────────────────────────────────────────────────────────────────
   Ce fichier garde le seul secret que le site détienne au nom de quelqu'un
   d'autre. Ce que ces tests protègent tient en trois phrases :

     · le mot de passe n'apparaît jamais dans ce qui est stocké ;
     · deux comptes au même mot de passe n'ont pas la même empreinte ;
     · une empreinte abîmée refuse la connexion, elle ne fait pas tomber la
       page en erreur.
  ────────────────────────────────────────────────────────────────────────────
*/

const MOT_DE_PASSE = 'un-mot-de-passe-honnête-2026';

describe('l’empreinte d’un mot de passe', () => {
  it('ne contient nulle part le mot de passe', async () => {
    const empreinte = await hacher(MOT_DE_PASSE);
    expect(empreinte).not.toContain(MOT_DE_PASSE);
    expect(empreinte).not.toContain('honnête');
  });

  it('porte l’algorithme et ses paramètres, pour pouvoir les durcir plus tard', async () => {
    const [algo, n, r, p] = (await hacher(MOT_DE_PASSE)).split('$');
    expect(algo).toBe('scrypt');
    expect(Number(n)).toBeGreaterThanOrEqual(65_536);
    expect(Number(r)).toBeGreaterThanOrEqual(8);
    expect(Number(p)).toBeGreaterThanOrEqual(1);
  });

  it('diffère à chaque fois : deux comptes au même mot de passe ne se ressemblent pas', async () => {
    const [a, b] = await Promise.all([hacher(MOT_DE_PASSE), hacher(MOT_DE_PASSE)]);
    expect(a).not.toBe(b);
    // …et les deux se vérifient quand même.
    expect(await verifier(MOT_DE_PASSE, a)).toBe(true);
    expect(await verifier(MOT_DE_PASSE, b)).toBe(true);
  });
});

describe('la vérification', () => {
  it('accepte le bon mot de passe', async () => {
    expect(await verifier(MOT_DE_PASSE, await hacher(MOT_DE_PASSE))).toBe(true);
  });

  it.each([
    ['un mauvais mot de passe', 'un-mot-de-passe-honnete-2026'],
    ['la casse changée', 'Un-Mot-De-Passe-Honnête-2026'],
    ['un caractère en trop', `${MOT_DE_PASSE} `],
    ['vide', ''],
  ])('refuse %s', async (_cas, tentative) => {
    expect(await verifier(tentative, await hacher(MOT_DE_PASSE))).toBe(false);
  });

  it('accepte deux écritures Unicode du même mot de passe', async () => {
    /*
      « é » s'écrit d'une ou deux unités selon le clavier et le système. Sans
      normalisation, quelqu'un pourrait taper exactement le même mot de passe
      sur un autre appareil et se voir refuser, sans jamais comprendre.
    */
    const compose = 'mot-de-passe-café-2026';
    const decompose = 'mot-de-passe-café-2026';

    expect(await verifier(decompose, await hacher(compose))).toBe(true);
  });

  it.each([
    ['illisible', 'nimportequoi'],
    ['tronquée', 'scrypt$65536$8$1$selsansempreinte'],
    ['algorithme inconnu', 'md5$1$1$1$sel$empreinte'],
    ['paramètres non numériques', 'scrypt$N$r$p$sel$empreinte'],
    ['vide', ''],
  ])('refuse sans lever sur une empreinte %s', async (_cas, stocke) => {
    /*
      Une ligne abîmée en base doit refuser la connexion, pas rendre une
      erreur 500 : la page de connexion resterait cassée pour tout le monde
      pendant qu'on cherche la cause.
    */
    await expect(verifier(MOT_DE_PASSE, stocke)).resolves.toBe(false);
  });
});

describe('le rehachage', () => {
  it('n’est pas demandé pour une empreinte fraîche', async () => {
    expect(besoinDeRehachage(await hacher(MOT_DE_PASSE))).toBe(false);
  });

  it('est demandé pour des paramètres plus faibles', () => {
    expect(besoinDeRehachage('scrypt$16384$8$1$sel$empreinte')).toBe(true);
  });

  it('est demandé pour une empreinte illisible : on ne garde pas ce qu’on ne comprend pas', () => {
    expect(besoinDeRehachage('nimportequoi')).toBe(true);
  });
});
