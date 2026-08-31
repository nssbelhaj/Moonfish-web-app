import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { countWords, markdownToHtml } from './markdown';

const GUIDES_DIR = path.join(process.cwd(), 'src', 'content', 'guides');

const frontMatterSchema = z.object({
  title: z.string().min(8),
  description: z.string().min(40).max(320),
  published: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().min(2),
});

export interface Guide {
  slug: string;
  title: string;
  description: string;
  /** Date ISO de publication. */
  published: string;
  category: string;
  /** Corps en markdown brut. */
  body: string;
  html: string;
  wordCount: number;
  /** Temps de lecture arrondi à la minute, sur une base de 200 mots/min. */
  readingMinutes: number;
}

/**
 * Front-matter minimal : `clé: valeur`, une paire par ligne, guillemets
 * optionnels. Pas de YAML complet — quatre clés ne justifient pas une
 * dépendance, et le schéma Zod ci-dessus fait le contrôle d'intégrité.
 */
function parseFrontMatter(raw: string): { data: Record<string, string>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!match) return { data: {}, body: raw };

  const data: Record<string, string> = {};
  for (const line of (match[1] ?? '').split('\n')) {
    const pair = /^([a-zA-Z]+):\s*(.*)$/.exec(line.trim());
    if (!pair) continue;
    const key = pair[1] ?? '';
    const value = (pair[2] ?? '').trim().replace(/^["'](.*)["']$/, '$1');
    data[key] = value;
  }

  return { data, body: (match[2] ?? '').trim() };
}

async function readGuide(fileName: string): Promise<Guide> {
  const slug = fileName.replace(/\.md$/, '');
  const raw = await readFile(path.join(GUIDES_DIR, fileName), 'utf8');
  const { data, body } = parseFrontMatter(raw);

  // Un front-matter incomplet casse le build plutôt que de publier un article
  // sans titre ni description : une page mal balisée est pire qu'une page absente.
  const meta = frontMatterSchema.parse(data);
  const wordCount = countWords(body);

  return {
    slug,
    ...meta,
    body,
    html: markdownToHtml(body),
    wordCount,
    readingMinutes: Math.max(1, Math.round(wordCount / 200)),
  };
}

/** Tous les guides, du plus récent au plus ancien. */
export async function listGuides(): Promise<Guide[]> {
  const files = (await readdir(GUIDES_DIR)).filter((file) => file.endsWith('.md'));
  const guides = await Promise.all(files.map(readGuide));
  return guides.sort((a, b) => b.published.localeCompare(a.published));
}

export async function getGuide(slug: string): Promise<Guide | null> {
  const guides = await listGuides();
  return guides.find((guide) => guide.slug === slug) ?? null;
}
