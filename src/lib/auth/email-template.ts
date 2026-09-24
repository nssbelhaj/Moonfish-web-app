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

/**
 * Palette des courriels, EXPORTÉE.
 *
 * Un client de messagerie n'applique pas les variables CSS : ces valeurs sont
 * écrites en clair faute d'alternative, et ce fichier est le seul exempté du
 * contrôle des couleurs littérales. Tout gabarit de courriel doit donc les
 * importer d'ici plutôt que de les recopier — sinon l'exemption s'étend
 * fichier par fichier, et deux courriels du même site finissent de couleurs
 * différentes.
 */
export const COURRIEL = {
  encre: '#1c2b31',
  sonde: '#1c4f5e',
  muet: '#4f656f',
  blanc: '#ffffff',
} as const;

const ENCRE = COURRIEL.encre;
const SONDE = COURRIEL.sonde;
const MUET = COURRIEL.muet;
const BLANC = COURRIEL.blanc;

export const SITE_NAME = 'Luna Marea';

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

/* ────────────────────────────────────────────────────────────────────────────
   Le courriel de la veille d'une sortie.

   Il rapporte, il ne conseille pas — sauf pour le danger, qui n'est pas un
   conseil mais une règle : houle au-delà de 2,5 m ou vent au-delà de 50 km/h,
   et le message commence par « ne sortez pas », avant même le score. Le
   score, lui, est ce qu'il est : un chiffre et son palier, avec les facteurs
   qui l'expliquent.

   Un seul courriel par sortie. Il n'y a pas de « rappel J-3 », pas de relance
   « vos conditions se sont améliorées » : la personne a demandé d'être
   prévenue la veille, elle l'est la veille.
   ──────────────────────────────────────────────────────────────────────────── */

const DANGER = '#a83232';
const BON = '#2e7d5b';

export interface OutingAlertContent {
  spotName: string;
  spotUrl: string;
  /** Heure locale de la sortie, déjà formatée. */
  when: string;
  danger: boolean;
  dangerMessage: string | null;
  score: number | null;
  tierLabel: string;
  belowThreshold: boolean;
  minScore: number | null;
  /** Lignes « libellé : valeur », dans l'ordre d'importance. */
  facts: readonly { label: string; value: string }[];
  note: string | null;
  accountUrl: string;
  host: string;
}

export function outingAlertEmail(c: OutingAlertContent): { subject: string; text: string; html: string } {
  const scoreText = c.score === null ? 'indisponible' : `${c.score.toFixed(1).replace('.', ',')} / 10 · ${c.tierLabel}`;

  const subject = c.danger
    ? `Danger — ne sortez pas à ${c.spotName} ${c.when}`
    : c.belowThreshold
      ? `Sous votre seuil — ${c.spotName} ${c.when} : ${scoreText}`
      : `Vos conditions à ${c.spotName} ${c.when} : ${scoreText}`;

  const factsText = c.facts.map((f) => `  ${f.label} : ${f.value}`).join('\n');

  const text = [
    c.danger
      ? `NE SORTEZ PAS. ${c.dangerMessage ?? 'Conditions dangereuses depuis le bord.'}`
      : null,
    `Sortie programmée : ${c.spotName}, ${c.when}.`,
    '',
    `Score prévu : ${scoreText}`,
    c.belowThreshold && c.minScore !== null ? `C’est sous le seuil de ${c.minScore} que vous aviez fixé.` : null,
    '',
    factsText,
    '',
    c.note ? `Votre note : ${c.note}` : null,
    c.note ? '' : null,
    `Détail et prévision à jour : ${c.spotUrl}`,
    '',
    'Vous recevez ce message parce que vous avez programmé cette sortie en demandant',
    'à être prévenu. Il n’y en aura pas d’autre pour cette sortie. Pour ne plus en',
    `recevoir, supprimez la sortie depuis votre compte : ${c.accountUrl}`,
    '',
    c.host,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  const factsHtml = c.facts
    .map(
      (f) =>
        `<tr><td style="padding: 4px 12px 4px 0; color: ${MUET};">${f.label}</td><td style="padding: 4px 0;">${f.value}</td></tr>`,
    )
    .join('');

  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; font-size: 15px; line-height: 1.6; color: ${ENCRE}; max-width: 520px;">
      ${
        c.danger
          ? `<p style="padding: 12px 14px; border: 2px solid ${DANGER}; border-radius: 9px; color: ${DANGER}; font-weight: 600;">Ne sortez pas. ${c.dangerMessage ?? 'Conditions dangereuses depuis le bord.'}</p>`
          : ''
      }
      <p>Sortie programmée : <strong>${c.spotName}</strong>, ${c.when}.</p>
      <p style="font-size: 20px; font-weight: 700; color: ${c.danger ? DANGER : c.belowThreshold ? MUET : BON};">
        ${scoreText}
      </p>
      ${
        c.belowThreshold && c.minScore !== null
          ? `<p style="color: ${MUET};">C’est sous le seuil de ${c.minScore} que vous aviez fixé.</p>`
          : ''
      }
      <table style="border-collapse: collapse; font-size: 14px;">${factsHtml}</table>
      ${c.note ? `<p style="font-size: 14px; color: ${MUET};">Votre note : ${c.note}</p>` : ''}
      <p style="margin: 24px 0;">
        <a href="${c.spotUrl}" style="display: inline-block; padding: 12px 20px; background: ${SONDE}; color: ${BLANC}; text-decoration: none; border-radius: 9px;">Voir la prévision à jour</a>
      </p>
      <p style="font-size: 13px; color: ${MUET};">
        Vous recevez ce message parce que vous avez programmé cette sortie en demandant à être prévenu.
        Il n’y en aura pas d’autre pour cette sortie. Pour ne plus en recevoir,
        <a href="${c.accountUrl}" style="color: ${SONDE};">supprimez la sortie depuis votre compte</a>.
      </p>
      <p style="font-size: 12px; color: ${MUET}; margin-top: 28px;">${c.host}</p>
    </div>
  `;

  return { subject, text, html };
}

/* ────────────────────────────────────────────────────────────────────────────
   Le courriel d'alerte sur un spot favori.

   Il n'existe que lorsque le seuil est atteint : pas de « rien à signaler »,
   pas de récapitulatif hebdomadaire. Le sujet porte le spot, le créneau et
   le score — tout ce qu'il faut pour décider sans ouvrir le message.
   ──────────────────────────────────────────────────────────────────────────── */

export interface FavoriteAlertContent {
  spotName: string;
  spotUrl: string;
  /** Le créneau, déjà formaté : « jeudi 25 septembre, 06:00 – 08:00 ». */
  when: string;
  score: number;
  tierLabel: string;
  minScore: number;
  facts: readonly { label: string; value: string }[];
  accountUrl: string;
  host: string;
}

export function favoriteAlertEmail(c: FavoriteAlertContent): { subject: string; text: string; html: string } {
  const scoreText = `${c.score.toFixed(1).replace('.', ',')} / 10 · ${c.tierLabel}`;
  const subject = `${c.spotName} passe à ${scoreText} — ${c.when}`;

  const factsText = c.facts.map((f) => `  ${f.label} : ${f.value}`).join('\n');

  const text = [
    `${c.spotName}, que vous suivez, atteint votre seuil de ${c.minScore}.`,
    '',
    `Créneau : ${c.when}`,
    `Score prévu : ${scoreText}`,
    '',
    factsText,
    '',
    `Prévision à jour : ${c.spotUrl}`,
    '',
    'Vous recevez ce message parce que vous avez demandé à être prévenu quand ce',
    'spot favori dépasse un seuil. Un même créneau n’est annoncé qu’une fois. Pour',
    `changer le seuil ou ne plus recevoir d’alerte : ${c.accountUrl}`,
    '',
    c.host,
  ].join('\n');

  const factsHtml = c.facts
    .map(
      (f) =>
        `<tr><td style="padding: 4px 12px 4px 0; color: ${MUET};">${f.label}</td><td style="padding: 4px 0;">${f.value}</td></tr>`,
    )
    .join('');

  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; font-size: 15px; line-height: 1.6; color: ${ENCRE}; max-width: 520px;">
      <p><strong>${c.spotName}</strong>, que vous suivez, atteint votre seuil de ${c.minScore}.</p>
      <p>Créneau : ${c.when}</p>
      <p style="font-size: 20px; font-weight: 700; color: ${BON};">${scoreText}</p>
      <table style="border-collapse: collapse; font-size: 14px;">${factsHtml}</table>
      <p style="margin: 24px 0;">
        <a href="${c.spotUrl}" style="display: inline-block; padding: 14px 22px; background: ${SONDE}; color: ${BLANC}; text-decoration: none; border-radius: 9px;">Voir la prévision</a>
      </p>
      <p style="font-size: 13px; color: ${MUET};">
        Vous recevez ce message parce que vous avez demandé à être prévenu quand ce spot
        favori dépasse un seuil. Un même créneau n’est annoncé qu’une fois.
        <a href="${c.accountUrl}" style="color: ${MUET};">Changer le seuil ou arrêter</a>.
      </p>
      <p style="font-size: 12px; color: ${MUET}; margin-top: 28px;">${c.host}</p>
    </div>
  `;

  return { subject, text, html };
}
