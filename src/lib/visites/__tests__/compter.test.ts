import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { cheminComptable, jourDe } from '../compter';

/**
 * Le compteur ne vaut que par ce qu'il ne fait pas. Ces tests fixent ce qui
 * est compté — un chemin nu — et refusent, à la source, tout ce qui
 * rapprocherait la route d'une personne.
 */
const RACINE = path.resolve(__dirname, '../../../..');

describe('cheminComptable', () => {
  it('garde un chemin de page tel quel', () => {
    expect(cheminComptable('/spots/france/bretagne/pen-hat')).toBe('/spots/france/bretagne/pen-hat');
    expect(cheminComptable('/')).toBe('/');
  });

  it('retire les paramètres et l’ancre : un jeton n’atteint jamais la table', () => {
    expect(cheminComptable('/compte/nouveau-mot-de-passe?token=abc123')).toBe('/compte/nouveau-mot-de-passe');
    expect(cheminComptable('/compte?next=%2Fspots')).toBe('/compte');
    expect(cheminComptable('/compte#espace-sorties')).toBe('/compte');
  });

  it('refuse ce qui n’est pas une page', () => {
    expect(cheminComptable('/api/visite')).toBeNull();
    expect(cheminComptable('/_next/static/x.js')).toBeNull();
    expect(cheminComptable('https://ailleurs.example/')).toBeNull();
    expect(cheminComptable('//ailleurs.example')).toBeNull();
    expect(cheminComptable('spots')).toBeNull();
    expect(cheminComptable(42)).toBeNull();
    expect(cheminComptable(null)).toBeNull();
    expect(cheminComptable('/' + 'a'.repeat(300))).toBeNull();
    expect(cheminComptable('/x<script>')).toBeNull();
  });

  it('unifie la barre finale', () => {
    expect(cheminComptable('/spots/')).toBe('/spots');
  });
});

describe('jourDe', () => {
  it('est la date UTC, la même pour tout le monde', () => {
    expect(jourDe(new Date('2026-09-24T23:30:00Z'))).toBe('2026-09-24');
    expect(jourDe(new Date('2026-09-24T23:30:00+02:00'))).toBe('2026-09-24');
  });
});

describe('ce que la route et le composant ne lisent JAMAIS', () => {
  // Les commentaires sont retirés : celui de la route nomme précisément ce
  // qu'elle refuse de lire, et se ferait prendre. Seul le CODE compte.
  const sansCommentaires = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const route = sansCommentaires(readFileSync(path.join(RACINE, 'src/app/api/visite/route.ts'), 'utf8'));
  const composant = sansCommentaires(
    readFileSync(path.join(RACINE, 'src/components/layout/Compteur.tsx'), 'utf8'),
  );

  it('la route ne touche ni adresse, ni agent, ni cookie', () => {
    for (const interdit of ['x-forwarded-for', 'x-real-ip', 'user-agent', 'cookies', 'referer']) {
      expect(route.toLowerCase(), `la route lit « ${interdit} »`).not.toContain(interdit);
    }
  });

  it('la route et le composant honorent Global Privacy Control et Do Not Track', () => {
    expect(route).toContain("'sec-gpc'");
    expect(route).toContain("'dnt'");
    expect(composant).toContain('globalPrivacyControl');
    expect(composant).toContain('doNotTrack');
  });

  it('le composant n’envoie que le chemin, vers notre origine', () => {
    expect(composant).toContain("sendBeacon('/api/visite', chemin)");
    expect(composant).not.toMatch(/localStorage|sessionStorage|document\.cookie|screen\.|referrer/);
  });
});
