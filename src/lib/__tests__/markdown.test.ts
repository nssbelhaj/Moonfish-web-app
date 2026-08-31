import { describe, expect, it } from 'vitest';
import { frenchTypography, markdownToHtml } from '../markdown';

describe('typographie française', () => {
  it('courbe l’apostrophe entre deux lettres', () => {
    expect(frenchTypography("c'est l'eau")).toBe('c\u2019est l\u2019eau');
  });

  it('pose une espace fine insécable avant les ponctuations doubles', () => {
    expect(frenchTypography('deux choses : voici')).toBe('deux choses\u202f: voici');
    expect(frenchTypography('vraiment ?')).toBe('vraiment\u202f?');
  });

  it('resserre les guillemets français', () => {
    expect(frenchTypography('« vent de mer »')).toBe('\u00ab\u202fvent de mer\u202f»');
  });

  it('laisse les URL intactes dans un lien markdown', () => {
    const html = markdownToHtml("Voir [le SHOM](https://maree.shom.fr) pour l'heure exacte.");
    expect(html).toContain('href="https://maree.shom.fr"');
    expect(html).not.toContain('https\u202f://');
    expect(html).toContain('l\u2019heure');
  });
});

describe('conversion markdown', () => {
  it('produit titres, paragraphes, listes et citations', () => {
    const html = markdownToHtml('## Titre\n\nUn paragraphe.\n\n- un\n- deux\n\n> Une citation.');
    expect(html).toContain('<h2>Titre</h2>');
    expect(html).toContain('<p>Un paragraphe.</p>');
    expect(html).toContain('<ul><li>un</li><li>deux</li></ul>');
    expect(html).toContain('<blockquote><p>Une citation.</p></blockquote>');
  });

  it('gère le gras et l’italique', () => {
    expect(markdownToHtml('Du **gras** et de l’*italique*.')).toContain('<strong>gras</strong>');
    expect(markdownToHtml('Du **gras** et de l’*italique*.')).toContain('<em>italique</em>');
  });

  /**
   * Le point qui rend `dangerouslySetInnerHTML` acceptable en aval : aucun
   * balisage brut du fichier markdown ne doit ressortir exécutable.
   */
  it('neutralise tout HTML brut présent dans la source', () => {
    const html = markdownToHtml('<script>alert(1)</script>\n\nSuite.');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('refuse les schémas d’URL dangereux dans les liens', () => {
    const html = markdownToHtml('[clic](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="#"');
  });

  it('ouvre les liens externes dans un nouvel onglet, pas les internes', () => {
    expect(markdownToHtml('[a](https://exemple.fr)')).toContain('target="_blank"');
    expect(markdownToHtml('[b](/spots)')).not.toContain('target="_blank"');
  });
});
