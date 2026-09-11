import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Les onglets de l'espace personnel tiennent en CSS pure : chaque onglet est un
 * lien vers l'ancre de son panneau, et `:target` fait le reste.
 *
 * Ce montage a une faiblesse précise, et c'est elle qu'on surveille ici : un
 * onglet dont l'ancre ne désigne AUCUN panneau ne provoque pas d'erreur. Il
 * masque simplement le panneau par défaut sans en montrer un autre, et la page
 * se vide. Rien dans le compilateur ni dans le navigateur ne le signale — seul
 * un test qui lit les deux fichiers ensemble peut l'attraper.
 */

const RACINE = path.resolve(__dirname, '../../..');
const PAGE = readFileSync(path.join(RACINE, 'src/app/compte/page.tsx'), 'utf8');
const CSS = readFileSync(path.join(RACINE, 'src/app/globals.css'), 'utf8');

function toutes(source: string, motif: RegExp): string[] {
  return [...source.matchAll(motif)].flatMap((m) => (m[1] === undefined ? [] : [m[1]]));
}

const onglets = toutes(PAGE, /href="#(espace-[a-z-]+)"/g);
const panneaux = toutes(PAGE, /id="(espace-[a-z-]+)" className="panneau-espace/g);

describe('onglets de l’espace personnel', () => {
  it('en déclare autant qu’il y a de panneaux', () => {
    expect(onglets.length).toBeGreaterThanOrEqual(5);
    expect([...onglets].sort()).toStrictEqual([...panneaux].sort());
  });

  it('n’en laisse aucun pointer dans le vide', () => {
    for (const cible of onglets) {
      expect(panneaux, `l’onglet #${cible} ne désigne aucun panneau`).toContain(cible);
    }
  });

  it('n’en laisse aucun inatteignable', () => {
    for (const panneau of panneaux) {
      expect(onglets, `le panneau #${panneau} n’a pas d’onglet`).toContain(panneau);
    }
  });

  it('ouvre le premier panneau sans clic', () => {
    // Le panneau par défaut est nommé dans le CSS. S'il ne correspondait plus
    // au premier onglet, la page s'ouvrirait sur un onglet inactif d'apparence.
    expect(CSS).toContain(
      '.espace-compte:not(:has(.panneau-espace:target)) #espace-profil',
    );
    expect(onglets[0]).toBe('espace-profil');
  });

  it('ne masque jamais par un sélecteur plus fort que l’ouverture', () => {
    /*
      Le défaut a d'abord été écrit `.panneau-espace:not(#espace-profil)`. Un
      `:not()` porte la spécificité de ce qu'il contient : ce masquage battait
      `.panneau-espace:target`, et cliquer sur un onglet repliait le profil
      SANS rien ouvrir. La page se vidait, sans erreur nulle part. Aucun
      identifiant ne doit donc apparaître dans la règle de masquage.
    */
    const masquage = CSS.slice(
      CSS.indexOf('.espace-compte .panneau-espace {'),
      CSS.indexOf('.espace-compte .panneau-espace:target'),
    );

    expect(masquage).not.toBe('');
    expect(masquage).not.toContain('#');
  });

  it('marque chaque onglet actif quand son panneau est visé', () => {
    for (const panneau of panneaux) {
      if (panneau === 'espace-profil') continue;

      expect(
        CSS,
        `aucune règle d’onglet actif pour #${panneau} : il resterait éteint une fois ouvert`,
      ).toContain(`.espace-compte:has(#${panneau}:target) .onglet-espace[href='#${panneau}']`);
    }
  });

  it('ne masque rien hors d’une garde `@supports`', () => {
    /*
      Sans la garde, un navigateur sans `:has()` masquerait quatre panneaux sur
      cinq DÉFINITIVEMENT : les onglets n'y rallumeraient rien, et le carnet
      comme l'effacement du compte deviendraient inatteignables. Une page
      longue vaut mieux qu'un compte amputé.
    */
    const garde = CSS.indexOf('@supports selector(:has(*)) {', CSS.indexOf('.onglets-espace'));
    const masquage = CSS.indexOf('.espace-compte .panneau-espace {');

    expect(garde).toBeGreaterThan(-1);
    expect(masquage).toBeGreaterThan(garde);
  });
});
