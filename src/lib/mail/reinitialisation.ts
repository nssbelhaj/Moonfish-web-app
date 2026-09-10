import { COURRIEL, SITE_NAME } from '@/lib/auth/email-template';
import { sendMail } from '@/lib/mail/send';

/**
 * Courriel de réinitialisation de mot de passe.
 *
 * Il porte un pouvoir : quiconque ouvre ce lien peut choisir un nouveau mot
 * de passe. Trois conséquences sur sa rédaction —
 *
 *   · la durée de validité est ANNONCÉE, pour qu'un lien vieux d'un jour ne
 *     laisse pas croire à une panne ;
 *   · on dit quoi faire si la demande ne vient pas de la personne, plutôt que
 *     de laisser un courriel inattendu sans explication ;
 *   · aucune donnée du compte n'y figure — ni nom, ni prénom, ni date de
 *     naissance. Un courriel se transfère, et il n'a pas à emporter cela.
 */
export async function envoyerReinitialisation(
  destinataire: string,
  lien: string,
): Promise<void> {
  const texte = [
    `Vous avez demandé un nouveau mot de passe pour ${SITE_NAME}.`,
    '',
    'Ouvrez ce lien pour en choisir un :',
    lien,
    '',
    'Il est valable une heure et ne sert qu’une fois.',
    '',
    'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message :',
    'votre mot de passe actuel reste valable et personne n’a eu accès à votre compte.',
  ].join('\n');

  /* Les couleurs viennent du gabarit commun : deux courriels du même site
     n'ont pas à se ressembler « à peu près ». */
  const html = `<!doctype html><html lang="fr"><body style="font-family:system-ui,sans-serif;line-height:1.55;color:${COURRIEL.encre}">
<p>Vous avez demandé un nouveau mot de passe pour <strong>${SITE_NAME}</strong>.</p>
<p><a href="${lien}" style="display:inline-block;padding:12px 18px;background:${COURRIEL.sonde};color:${COURRIEL.blanc};border-radius:8px;text-decoration:none">Choisir un nouveau mot de passe</a></p>
<p style="color:${COURRIEL.muet};font-size:14px">Ce lien est valable une heure et ne sert qu’une fois.</p>
<p style="color:${COURRIEL.muet};font-size:14px">Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe actuel reste valable et personne n’a eu accès à votre compte.</p>
</body></html>`;

  const resultat = await sendMail({
    to: destinataire,
    subject: `Nouveau mot de passe pour ${SITE_NAME}`,
    text: texte,
    html,
  });

  // Échouer bruyamment : un envoi refusé qui passerait pour un succès
  // laisserait quelqu'un attendre le seul moyen de récupérer son compte.
  if (!resultat.ok) throw new Error(resultat.reason);
}
