import { describe, expect, it } from 'vitest';

import { smtpWarning } from '../config';

/*
  ────────────────────────────────────────────────────────────────────────────
   Ce que ces tests protègent.

   `smtp://boite@domaine.fr:MOT/PASSE@smtp.hebergeur.com:587` ne lève AUCUNE
   erreur. L'analyseur coupe au premier « / » : l'hôte devient `domaine.fr` et
   le mot de passe devient vide. La tentative de connexion part donc vers une
   machine qui n'est pas le serveur d'envoi.

   Mesuré avec le vrai `nodemailer`, pas déduit. C'est une panne silencieuse
   qui se présente comme « le serveur ne répond pas », et l'avertissement
   existe pour qu'elle porte son nom.

   Le « @ », lui, ne pose AUCUN problème : la documentation de ce dépôt
   affirmait qu'il fallait l'encoder en %40, c'était faux.
  ────────────────────────────────────────────────────────────────────────────
*/

const HOTE = '@smtp.hostinger.com:587';

describe('les caractères qui détournent une URL SMTP sont signalés', () => {
  it.each([
    ['barre oblique', '/'],
    ['point d’interrogation', '?'],
    ['croisillon', '#'],
    ['pourcent', '%'],
  ])('%s dans le mot de passe', (_nom, caractere) => {
    const warning = smtpWarning(`smtp://boite@domaine.fr:GoT${caractere}Zut${HOTE}`);

    expect(warning).not.toBeNull();
    expect(warning).toContain(caractere);
    // Le message doit donner la correction, pas seulement le constat.
    expect(warning).toMatch(/%2F|%3F|%23|%25/);
    expect(warning).toMatch(/sans lever d’erreur|mauvais hôte/);
  });
});

describe('ce qui est licite ne déclenche rien', () => {
  it.each([
    ['arobase non encodé', `smtp://boite@domaine.fr:GoT@100*${HOTE}`],
    ['arobase encodé', `smtp://boite%40domaine.fr:GoT100*${HOTE}`],
    ['astérisque et point d’exclamation', `smtp://boite@domaine.fr:GoT!100*${HOTE}`],
    ['mot de passe simple', `smtp://boite@domaine.fr:motdepasse${HOTE}`],
    ['pourcent correctement encodé', `smtp://boite@domaine.fr:GoT%25100${HOTE}`],
    ['barre oblique encodée', `smtp://boite@domaine.fr:GoT%2F100${HOTE}`],
  ])('%s', (_nom, url) => {
    expect(smtpWarning(url)).toBeNull();
  });

  it('une variable absente ne dit rien', () => {
    expect(smtpWarning(undefined)).toBeNull();
    expect(smtpWarning('')).toBeNull();
  });

  it('le « / » du schéma n’est pas confondu avec celui d’un mot de passe', () => {
    // « smtp:// » en contient deux : les compter naïvement signalerait TOUTES
    // les URL, et un avertissement toujours affiché n'est plus lu.
    expect(smtpWarning(`smtp://boite@domaine.fr:motdepasse${HOTE}`)).toBeNull();
  });

  it('un code d’échappement fortuit est signalé, pas toléré', () => {
    // « %41 » est syntaxiquement valide et se décode en « A » : le mot de
    // passe transmis n'est alors pas celui qui a été saisi. Un critère
    // « deux chiffres hexadécimaux donc valide » laisserait passer ce cas.
    expect(smtpWarning(`smtp://boite@domaine.fr:GoT%41100${HOTE}`)).not.toBeNull();
  });

  it('une chaîne sans arobase ne provoque pas d’erreur', () => {
    expect(smtpWarning('smtp://smtp.hostinger.com:587')).toBeNull();
  });
});
