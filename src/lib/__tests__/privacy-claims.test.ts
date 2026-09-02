import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { CLIENT_STORAGE, CLIENT_STORAGE_WRITE_SITES, PROCESSORS } from '@/data/legal';
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

describe('tout ce que le site écrit dans le navigateur est déclaré', () => {
  /**
   * On compte les points d'ÉCRITURE par fichier, pas les clés.
   *
   * Les clés ne suffisent pas : celle du thème est une constante importée, et
   * celle de la session porte l'identifiant du projet Supabase, inconnu du
   * dépôt. Le lieu et le nombre des écritures, eux, sont vérifiables — et une
   * écriture ajoutée quelque part est exactement ce qu'on veut voir échouer.
   */
  function scanWrites(): Map<string, number> {
    const counts = new Map<string, number>();

    for (const file of SOURCES) {
      const source = read(file);
      let total = 0;

      for (const pattern of [
        /\b(?:window\.)?localStorage\.setItem\s*\(/g,
        /\b(?:window\.)?sessionStorage\.setItem\s*\(/g,
        /document\.cookie\s*=/g,
        /\bcookieStore\.set\s*\(/g,
        /\.cookies\.set\s*\(/g,
      ]) {
        total += Array.from(source.matchAll(pattern)).length;
      }

      if (total > 0) counts.set(path.relative(ROOT, file), total);
    }

    return counts;
  }

  it('n’écrit nulle part ailleurs que dans les fichiers déclarés', () => {
    const found = scanWrites();
    const declared = new Set(CLIENT_STORAGE_WRITE_SITES.map((site) => site.file));

    for (const file of found.keys()) {
      expect(
        declared.has(file),
        `écriture navigateur non déclarée dans src/data/legal.ts : ${file}`,
      ).toBe(true);
    }
  });

  it('écrit exactement autant de fois qu’annoncé, fichier par fichier', () => {
    const found = scanWrites();

    for (const site of CLIENT_STORAGE_WRITE_SITES) {
      expect(found.get(site.file), `écritures dans ${site.file}`).toBe(site.writes);
    }
  });

  it('rattache chaque point d’écriture à un stockage décrit sur la page', () => {
    const described = new Set(CLIENT_STORAGE.map((entry) => entry.key));
    for (const site of CLIENT_STORAGE_WRITE_SITES) {
      expect(described, `stockage non décrit : ${site.entry}`).toContain(site.entry);
    }
  });

  it('déclare la clé réellement employée par la bascule de thème', () => {
    expect(CLIENT_STORAGE.map((entry) => entry.key)).toContain(THEME_STORAGE_KEY);
  });

  it('n’a qu’un seul cookie, dispensé de consentement, et seulement avec les comptes', () => {
    // La page annonce qu'il n'y a pas de bandeau de consentement. Cela ne tient
    // que si TOUS les cookies sont strictement nécessaires. Un cookie de mesure
    // d'audience ajouté ici ferait tomber ce test — et il devrait, puisqu'il
    // rendrait la phrase fausse.
    const cookies = CLIENT_STORAGE.filter((entry) => entry.kind === 'cookie');
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.consentRequired).toBe(false);
    expect(cookies[0]?.scope).toBe('accounts');
  });

  it('ne déclare aucun stockage soumis à consentement', () => {
    expect(CLIENT_STORAGE.filter((entry) => entry.consentRequired)).toStrictEqual([]);
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

  it('ne fait partir aucun appel réseau du navigateur vers une URL écrite en dur', () => {
    // Le navigateur joint bien Supabase — pour la connexion et l'envoi des
    // photos — mais par une adresse VENUE DE LA CONFIGURATION, déclarée sur la
    // page. Une URL en dur dans un composant client serait, elle, un tiers
    // qu'aucune déclaration ne couvre.
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
    /*
      Les fournisseurs de données — marée, météo — sont appelés depuis le
      SERVEUR : ni Stormglass ni Open-Meteo ne voient l'adresse IP du visiteur,
      et ne peuvent donc pas savoir quel spot il consulte.

      Depuis le passage à MySQL, l'hébergeur est le SEUL tiers que le navigateur
      joigne — la base, les photos et les courriels sont chez lui, et tout passe
      par notre domaine. Si un fournisseur de données basculait côté client, sa
      ligne devrait changer sur la page AVANT le code.
    */
    const browserFacing = PROCESSORS.filter((processor) => processor.browserContact);
    expect(browserFacing.map((processor) => processor.name)).toStrictEqual([
      'Hostinger International Ltd',
    ]);
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
