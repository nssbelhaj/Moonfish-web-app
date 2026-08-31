/**
 * Convertisseur Markdown → HTML minimal.
 *
 * Volontairement réduit à ce dont les guides ont besoin : titres, paragraphes,
 * listes, citations, gras, italique et liens. Aucune dépendance, donc aucun
 * poids ajouté au bundle et aucune surface d'attaque supplémentaire.
 *
 * SÉCURITÉ : le HTML brut n'est pas supporté. Tout le contenu est échappé AVANT
 * transformation, si bien qu'un `<script>` écrit dans un fichier markdown
 * ressortirait affiché en toutes lettres, jamais exécuté. C'est ce qui rend
 * l'usage de `dangerouslySetInnerHTML` défendable en aval.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Typographie française.
 *
 * Apostrophe courbe, et espace fine insécable avant les ponctuations doubles
 * comme après le guillemet ouvrant. Une insécable ordinaire serait trop large
 * et une espace normale autoriserait un retour à la ligne devant le signe.
 *
 * Appliquée uniquement HORS des liens et du code : une espace fine glissée dans
 * un « https:// » casserait l'URL.
 */
export function frenchTypography(text: string): string {
  return text
    .replace(/(\w)'(\w)/g, '$1\u2019$2')
    .replace(/ ([:;!?»])/g, '\u202f$1')
    .replace(/« /g, '\u00ab\u202f');
}

/** Découpe en segments protégés (liens, code) et segments typographiables. */
function applyTypography(text: string): string {
  const protectedPattern = /(\[[^\]]+\]\([^)\s]+\)|`[^`]+`)/g;
  return text
    .split(protectedPattern)
    .map((segment, index) => (index % 2 === 1 ? segment : frenchTypography(segment)))
    .join('');
}

function inline(text: string): string {
  return escapeHtml(applyTypography(text))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, href: string) => {
      // Seuls les liens internes et http(s) passent : pas de `javascript:`.
      const safe = /^(https?:\/\/|\/|#)/.test(href) ? href : '#';
      const external = safe.startsWith('http');
      return `<a href="${safe}"${external ? ' rel="noopener noreferrer" target="_blank"' : ''}>${label}</a>`;
    });
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const output: string[] = [];
  let listBuffer: string[] = [];
  let paragraphBuffer: string[] = [];

  const flushList = (): void => {
    if (listBuffer.length === 0) return;
    output.push(`<ul>${listBuffer.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
    listBuffer = [];
  };

  const flushParagraph = (): void => {
    if (paragraphBuffer.length === 0) return;
    output.push(`<p>${inline(paragraphBuffer.join(' '))}</p>`);
    paragraphBuffer = [];
  };

  const flushAll = (): void => {
    flushParagraph();
    flushList();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim().length === 0) {
      flushAll();
      continue;
    }

    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      const level = heading[1]?.length ?? 2;
      output.push(`<h${level}>${inline(heading[2] ?? '')}</h${level}>`);
      continue;
    }

    const listItem = /^[-*]\s+(.*)$/.exec(line);
    if (listItem) {
      flushParagraph();
      listBuffer.push(listItem[1] ?? '');
      continue;
    }

    const quote = /^>\s+(.*)$/.exec(line);
    if (quote) {
      flushAll();
      output.push(`<blockquote><p>${inline(quote[1] ?? '')}</p></blockquote>`);
      continue;
    }

    flushList();
    paragraphBuffer.push(line.trim());
  }

  flushAll();
  return output.join('\n');
}

/** Nombre de mots du corps, pour estimer un temps de lecture honnête. */
export function countWords(markdown: string): number {
  return markdown
    .replace(/[#>*`\-[\]()]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}
