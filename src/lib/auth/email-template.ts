/**
 * Le courriel de connexion.
 *
 * ─── Pourquoi des couleurs écrites en clair ici ───────────────────────────
 *
 * La règle D22 interdit les littéraux de couleur partout ailleurs : le thème
 * doit rester changeable sans toucher un composant. Un courriel échappe à
 * cette règle par nécessité — les clients de messagerie n'appliquent ni
 * variables CSS ni feuille externe, et beaucoup n'acceptent que le style en
 * ligne. Les valeurs ci-dessous reprennent les tokens du thème clair.
 *
 * Le gabarit par défaut d'Auth.js est en anglais, centré, avec un gros bouton
 * coloré — exactement ce à quoi ressemble un courriel d'hameçonnage. Celui-ci
 * est sobre, en français, dit ce qu'il est, et donne le lien EN CLAIR sous le
 * bouton pour que la personne puisse le lire avant de cliquer.
 */

const ENCRE = '#1c2b31';
const SONDE = '#1c4f5e';
const MUET = '#4f656f';
const BLANC = '#ffffff';

export const SITE_NAME = 'Moonfish';

export function verificationEmail(url: string, host: string): { text: string; html: string } {
  const text = [
    `Voici votre lien de connexion à ${SITE_NAME} :`,
    '',
    url,
    '',
    'Il est valable une heure et ne fonctionne qu’une seule fois.',
    '',
    'Si vous n’avez pas demandé cette connexion, ignorez ce message : personne',
    'ne peut accéder à votre compte sans ce lien, et aucune action n’a été faite.',
    '',
    host,
  ].join('\n');

  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; font-size: 15px; line-height: 1.6; color: ${ENCRE}; max-width: 520px;">
      <p>Voici votre lien de connexion à <strong>${SITE_NAME}</strong> :</p>
      <p style="margin: 24px 0;">
        <a href="${url}" style="display: inline-block; padding: 14px 22px; background: ${SONDE}; color: ${BLANC}; text-decoration: none; border-radius: 9px;">Se connecter</a>
      </p>
      <p style="font-size: 13px; color: ${MUET};">
        Ou copiez cette adresse dans votre navigateur :<br />
        <span style="word-break: break-all;">${url}</span>
      </p>
      <p style="font-size: 13px; color: ${MUET};">
        Le lien est valable une heure et ne fonctionne qu’une seule fois.
      </p>
      <p style="font-size: 13px; color: ${MUET};">
        Si vous n’avez pas demandé cette connexion, ignorez ce message : personne ne peut
        accéder à votre compte sans ce lien, et aucune action n’a été faite.
      </p>
      <p style="font-size: 12px; color: ${MUET}; margin-top: 28px;">${host}</p>
    </div>
  `;

  return { text, html };
}
