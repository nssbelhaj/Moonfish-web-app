import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PUBLISHER } from '@/data/legal';
import { SITE_NAME } from '@/lib/auth/email-template';
import { normalizeSiteUrl } from '@/lib/routes';
import { THEME_STORAGE_KEY } from '@/lib/theme';

/*
  ────────────────────────────────────────────────────────────────────────────
   Le nom du site apparaît à une centaine d'endroits : titres, métadonnées,
   JSON-LD, image de partage, courriels, guides, clé de stockage, nom du
   fichier d'export. Un renommage à moitié fait ne casse RIEN — il laisse
   simplement l'ancien nom traîner dans un courriel ou un pied de page, et
   personne ne le voit avant qu'un utilisateur le signale.

   Ces tests refusent tout résidu de l'ancien nom, et vérifient que les trois
   endroits où l'identité est déclarée disent la même chose.
  ────────────────────────────────────────────────────────────────────────────
*/

const ANCIENS_NOMS = ['Moonfish', 'moonfish'];

/**
 * La base de production s'appelle encore `u969082232_moonfish`, et c'est
 * DÉFINITIF : Hostinger nomme ses bases à la création, le nom n'est pas
 * modifiable, et une base ne se renomme pas pour suivre une marque. Ce nom
 * apparaît dans un test de lecture de configuration, où il sert justement
 * d'exemple réel.
 */
const NOM_BASE_PRODUCTION = 'u969082232_moonfish';

/**
 * Retire les commentaires avant l'inspection.
 *
 * La règle porte sur ce que le site PUBLIE et sur ses identifiants, pas sur ce
 * que le code se raconte. `routes.ts` explique légitimement que le domaine de
 * repli valait autrefois `moonfish.fish` — interdire la phrase reviendrait à
 * interdire d'expliquer l'histoire d'une décision, ce qui est précisément ce
 * que ce dépôt cherche à conserver.
 */
function sansCommentaires(source: string, fichier: string): string {
  if (fichier.endsWith('.md')) return source;

  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * `db/migrations/` est EXEMPTÉ, et ce n'est pas un oubli.
 *
 * Le script de migration garde l'empreinte SHA-256 de chaque fichier appliqué
 * et refuse tout fichier modifié depuis — y compris pour un simple
 * commentaire. Renommer le titre d'une migration déjà passée ferait échouer le
 * déploiement suivant sur « a CHANGÉ depuis son application ». Vérifié : la
 * tentative sort en 1.
 *
 * L'ancien nom reste donc dans l'en-tête des migrations, définitivement. Le
 * prix est une incohérence dans deux fichiers que seul un développeur ouvre ;
 * l'alternative était un déploiement cassé.
 */
function fichiersPublies(dossier = 'src'): string[] {
  const trouves: string[] = [];

  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);

    if (entree.isDirectory()) {
      trouves.push(...fichiersPublies(chemin));
      continue;
    }

    if (/\.(ts|tsx|css|md)$/.test(entree.name)) trouves.push(chemin);
  }

  return trouves;
}

describe('l’identité du site est cohérente', () => {
  it('le nom affiché est celui du courriel de connexion', () => {
    expect(SITE_NAME).toBe('Luna Marea');
  });

  it('l’adresse de contact publiée est sur le domaine du site', () => {
    /*
      La coïncidence n'est pas décorative : une adresse de contact sur un autre
      domaine que le site est le premier signe d'un renommage inachevé, et
      c'est aussi ce qui fait échouer SPF et DKIM à l'envoi.
    */
    const domaineDuSite = new URL(normalizeSiteUrl(undefined)).hostname;
    expect(PUBLISHER.email).not.toBeNull();
    expect(PUBLISHER.email?.split('@')[1]).toBe(domaineDuSite);
  });

  it('la clé de stockage porte le nom du site', () => {
    expect(THEME_STORAGE_KEY).toBe('lunamarea-theme');
  });
});

describe('aucun résidu de l’ancien nom', () => {
  it('nulle part dans `src/` — ce fichier et les migrations exceptés', () => {
    const residus: string[] = [];

    for (const fichier of fichiersPublies()) {
      // Ce test cite forcément l'ancien nom pour pouvoir l'interdire.
      if (fichier.endsWith('marque.test.ts')) continue;

      const source = sansCommentaires(readFileSync(fichier, 'utf8'), fichier)
        .split(NOM_BASE_PRODUCTION)
        .join('');

      for (const nom of ANCIENS_NOMS) {
        if (source.includes(nom)) residus.push(`${fichier} → « ${nom} »`);
      }
    }

    expect(
      residus,
      `${residus.join('\n')}\n\n` +
        'L’ancien nom traîne encore. Un renommage à moitié fait ne casse rien : ' +
        'il laisse juste l’ancien nom dans un courriel ou un pied de page, où ' +
        'personne ne le voit avant qu’un utilisateur le signale.',
    ).toStrictEqual([]);
  });

  it('ni dans le domaine de repli', () => {
    expect(normalizeSiteUrl(undefined)).toBe('https://lunamarea.fr');
  });
});
