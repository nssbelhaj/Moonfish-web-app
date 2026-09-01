import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { CLIENT_STORAGE, PROCESSORS } from '@/data/legal';
import { THEME_STORAGE_KEY } from '@/lib/theme';

/**
 * Une politique de confidentialité ne se périme pas par malveillance : elle se
 * périme parce que quelqu'un ajoute un `localStorage.setItem` un mardi. Ces
 * tests attachent les affirmations de `/confidentialite` au code qui les rend
 * vraies. Ils échouent au moment de l'ajout, pas au moment du contrôle.
 */

const ROOT = process.cwd();

function filesUnder(dir: string, extensions: readonly string[]): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return filesUnder(full, extensions);
    return extensions.some((ext) => full.endsWith(ext)) ? [full] : [];
  });
}

const SOURCES = filesUnder(path.join(ROOT, 'src'), ['.ts', '.tsx']).filter(
  (file) => !file.includes('__tests__'),
);

const CSS = filesUnder(path.join(ROOT, 'src'), ['.css']);

function read(file: string): string {
  return readFileSync(file, 'utf8');
}

describe('« aucun cookie, un seul stockage »', () => {
  /**
   * On compte les points d'ÉCRITURE, pas les clés : la clé du thème est une
   * constante importée, pas un littéral, et un test qui n'attraperait que les
   * littéraux laisserait passer exactement la même construction demain.
   */
  it('ne connaît pas d’écriture dans le navigateur qui ne soit pas déclarée', () => {
    const writes: string[] = [];

    for (const file of SOURCES) {
      const source = read(file);
      for (const pattern of [
        /\b(?:window\.)?localStorage\.setItem\s*\(/g,
        /\b(?:window\.)?sessionStorage\.setItem\s*\(/g,
        /document\.cookie\s*=/g,
        /\bcookies\(\)\s*\.\s*set\s*\(/g,
      ]) {
        writes.push(...Array.from(source.matchAll(pattern), () => path.relative(ROOT, file)));
      }
    }

    // Le script d'initialisation du thème LIT le stockage sans y écrire : seule
    // la bascule écrit. Un écart ici veut dire qu'un stockage est apparu et
    // qu'il doit être décrit dans `CLIENT_STORAGE`, donc sur la page.
    expect(
      writes,
      `stockage navigateur non déclaré dans src/data/legal.ts : ${writes.join(', ')}`,
    ).toHaveLength(CLIENT_STORAGE.length);
  });

  it('déclare la clé réellement employée par la bascule de thème', () => {
    expect(CLIENT_STORAGE.map((entry) => entry.key)).toContain(THEME_STORAGE_KEY);
  });

  it('n’a aucun cookie à déclarer', () => {
    // La page écrit « aucun cookie » sans nuance. Si un cookie apparaissait, la
    // phrase deviendrait fausse avant que quiconque y pense.
    expect(CLIENT_STORAGE.filter((entry) => entry.kind === 'cookie')).toHaveLength(0);
  });
});

describe('« aucune requête vers un tiers depuis votre navigateur »', () => {
  it('ne charge aucune ressource extérieure', () => {
    const offenders: string[] = [];

    for (const file of [...SOURCES, ...CSS]) {
      const source = read(file);
      for (const pattern of [
        /\bsrc\s*=\s*["'{`]\s*https?:\/\//g, // <script>, <img>, <iframe>
        /\bsrcSet\s*=\s*["'{`]\s*https?:\/\//g,
        /@import\s+(?:url\()?["']?https?:\/\//g,
        /url\(\s*["']?https?:\/\//g, // polices ou images de fond distantes
      ]) {
        if (pattern.test(source)) offenders.push(path.relative(ROOT, file));
      }
    }

    expect(
      offenders,
      `ressource tierce chargée automatiquement : ${offenders.join(', ')}`,
    ).toStrictEqual([]);
  });

  it('ne fait partir aucun appel réseau du navigateur vers un domaine extérieur', () => {
    const offenders: string[] = [];

    for (const file of SOURCES.filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))) {
      const source = read(file);
      if (!source.includes("'use client'")) continue;
      for (const match of source.matchAll(/\bfetch\s*\(\s*[`'"]([^`'"]+)/g)) {
        const url = match[1] ?? '';
        if (/^https?:\/\//.test(url)) offenders.push(`${path.relative(ROOT, file)} → ${url}`);
      }
    }

    expect(offenders, `appel client vers un tiers : ${offenders.join(', ')}`).toStrictEqual([]);
  });

  it('n’annonce comme joignables par le navigateur que les tiers qui le sont', () => {
    // Les fournisseurs de données sont appelés depuis le serveur. Si l'un d'eux
    // passait côté client, sa ligne devrait changer sur la page AVANT le code.
    const browserFacing = PROCESSORS.filter((processor) => processor.browserContact);
    expect(browserFacing.map((processor) => processor.name)).toStrictEqual(['Vercel Inc.']);
  });
});

describe('« nous ne journalisons pas votre adresse »', () => {
  it('n’écrit jamais l’e-mail d’une inscription dans la console', () => {
    // Une console d'hébergeur est un traitement de plus, avec ses accès et sa
    // durée propres. Y recopier l'adresse rendrait la page fausse.
    const waitlist = read(path.join(ROOT, 'src/lib/providers/mock/waitlist.ts'));
    for (const match of waitlist.matchAll(/console\.\w+\(([^\n]*)/g)) {
      expect(match[1] ?? '').not.toMatch(/\$\{\s*(?:email|entry\.email|parsed\.data\.email)\s*\}/);
    }
  });
});

describe('les pages légales restent atteignables', () => {
  const footer = read(path.join(ROOT, 'src/components/layout/SiteFooter.tsx'));
  const sitemap = read(path.join(ROOT, 'src/app/sitemap.ts'));

  for (const route of ['/mentions-legales', '/confidentialite']) {
    it(`${route} est dans le pied de page et dans le sitemap`, () => {
      // Une page légale que rien ne lie n'existe pas : l'obligation est
      // d'accès direct depuis toutes les pages du site.
      expect(footer, `${route} absent du pied de page`).toContain(route);
      expect(sitemap, `${route} absent du sitemap`).toContain(route);
    });
  }
});
