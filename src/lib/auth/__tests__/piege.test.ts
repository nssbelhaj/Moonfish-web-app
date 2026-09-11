import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CHAMP_PIEGE, piegeDeclenche } from '../piege';

const RACINE = path.resolve(__dirname, '../../../..');
const FORMULAIRE = readFileSync(
  path.join(RACINE, 'src/components/account/AuthForms.tsx'),
  'utf8',
);
const CSS = readFileSync(path.join(RACINE, 'src/app/globals.css'), 'utf8');

function formulaire(champs: Record<string, string>): FormData {
  const data = new FormData();
  for (const [nom, valeur] of Object.entries(champs)) data.set(nom, valeur);
  return data;
}

describe('le champ-piège', () => {
  it('laisse passer un formulaire où il est vide', () => {
    expect(piegeDeclenche(formulaire({ email: 'a@b.fr' }))).toBe(false);
    expect(piegeDeclenche(formulaire({ [CHAMP_PIEGE]: '' }))).toBe(false);
    expect(piegeDeclenche(formulaire({ [CHAMP_PIEGE]: '   ' }))).toBe(false);
  });

  it('laisse passer un formulaire où il est absent', () => {
    // Un navigateur sans JavaScript, un client qui n'envoie que les champs
    // remplis : l'absence n'est pas un aveu.
    expect(piegeDeclenche(new FormData())).toBe(false);
  });

  it('arrête celui qui l’a rempli', () => {
    expect(piegeDeclenche(formulaire({ [CHAMP_PIEGE]: 'http://spam.example' }))).toBe(true);
  });
});

describe('le champ-piège ne doit jamais attraper une personne', () => {
  /*
    Un piège qui attrape des humains n'est pas un piège, c'est une panne — et
    la personne concernée verrait son inscription refusée sans rien pouvoir
    comprendre. Trois protections, et le balisage doit porter les trois.
  */
  const bloc = FORMULAIRE.slice(
    FORMULAIRE.indexOf('className="piege-robot"'),
    FORMULAIRE.indexOf('</div>', FORMULAIRE.indexOf('className="piege-robot"')),
  );

  it('le retire des lecteurs d’écran', () => {
    expect(FORMULAIRE).toContain('aria-hidden="true" className="piege-robot"');
  });

  it('le retire du parcours au clavier', () => {
    expect(bloc).toContain('tabIndex={-1}');
  });

  it('empêche le navigateur de le remplir tout seul', () => {
    // Sans cela, un gestionnaire de mots de passe y verserait une valeur et
    // ferait refuser l'inscription d'une personne qui n'a rien fait.
    expect(bloc).toContain('autoComplete="off"');
  });

  it('le sort de l’écran sans le masquer', () => {
    /*
      `display: none` est ce que les robots sérieux testent AVANT de remplir.
      Le champ doit donc être rendu et simplement déplacé.
    */
    const regle = CSS.slice(CSS.indexOf('.piege-robot {'), CSS.indexOf('}', CSS.indexOf('.piege-robot {')));

    expect(regle).toContain('position: absolute');
    expect(regle).not.toContain('display: none');
    expect(regle).not.toContain('visibility: hidden');
  });
});

describe('aucun CAPTCHA d’un tiers', () => {
  it('ne charge rien depuis Google, Cloudflare ou hCaptcha', () => {
    /*
      La page de confidentialité affirme qu'aucune requête ne part du
      navigateur vers un tiers. Un CAPTCHA hébergé ailleurs ferait de chaque
      visiteur un visiteur de Google AVANT même qu'il ait un compte, et
      rendrait cette phrase fausse.
    */
    for (const tiers of ['recaptcha', 'hcaptcha', 'turnstile', 'gstatic', 'challenges.cloudflare']) {
      expect(FORMULAIRE.toLowerCase(), `${tiers} dans le formulaire de compte`).not.toContain(tiers);
    }
  });
});
