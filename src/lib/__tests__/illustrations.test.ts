import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ILLUSTRATIONS } from '@/components/guides/illustrations/Illustrations';
import { decouperIllustrations, illustrationsCitees, markdownToHtml } from '@/lib/markdown';

/**
 * Un guide qui cite une illustration que personne n'a dessinée afficherait
 * un trou ; une illustration que personne ne cite est du code mort. Les deux
 * listes se recouvrent, ou le test le dit.
 */
const RACINE = path.resolve(__dirname, '../../..');
const DOSSIER = path.join(RACINE, 'src/content/guides');

describe('les illustrations des guides', () => {
  const citees = new Map<string, string[]>();
  for (const fichier of readdirSync(DOSSIER).filter((f) => f.endsWith('.md'))) {
    for (const nom of illustrationsCitees(readFileSync(path.join(DOSSIER, fichier), 'utf8'))) {
      citees.set(nom, [...(citees.get(nom) ?? []), fichier]);
    }
  }

  it('sont toutes dessinées', () => {
    for (const [nom, fichiers] of citees) {
      expect(ILLUSTRATIONS[nom], `${nom} citée dans ${fichiers.join(', ')} mais pas dessinée`).toBeDefined();
    }
  });

  it('sont toutes citées au moins une fois', () => {
    for (const nom of Object.keys(ILLUSTRATIONS)) {
      expect(citees.has(nom), `${nom} dessinée mais citée nulle part`).toBe(true);
    }
  });

  it('passent par le convertisseur comme des repères, jamais comme du texte', () => {
    const html = markdownToHtml('Avant.\n\n[illustration: montage-deux-empiles]\n\nAprès.');
    expect(html).toContain('<!--illustration:montage-deux-empiles-->');
    expect(html).not.toContain('[illustration');
    const morceaux = decouperIllustrations(html);
    expect(morceaux.map((m) => m.illustration)).toStrictEqual(['montage-deux-empiles', null]);
    expect(morceaux[0]!.html).toContain('Avant.');
    expect(morceaux[1]!.html).toContain('Après.');
  });

  it('ne peuvent pas être forgées depuis un paragraphe', () => {
    // Un repère tapé au milieu d'une phrase est du texte échappé, pas un repère.
    const html = markdownToHtml('Texte <!--illustration:x--> texte.');
    expect(html).not.toContain('<!--illustration:x-->');
    expect(decouperIllustrations(html)).toHaveLength(1);
  });
});
