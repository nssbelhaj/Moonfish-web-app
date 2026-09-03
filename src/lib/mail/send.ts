import { smtpServer } from '@/lib/auth/config';

/**
 * Envoi d'un courriel transactionnel.
 *
 * Un seul chemin d'envoi pour tout ce qui n'est pas Auth.js — aujourd'hui les
 * alertes de sortie. Il lit la même configuration que les liens de connexion,
 * donc il n'y a pas de deuxième SMTP à renseigner, et il échoue de la même
 * façon : bruyamment, en refusant de faire passer un rejet pour un succès.
 */
export async function sendMail(message: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const server = smtpServer();
  const from = process.env.EMAIL_FROM?.trim();

  if (!server || !from) return { ok: false, reason: 'Envoi de courriel non configuré.' };

  try {
    const { createTransport } = await import('nodemailer');
    const transport = createTransport(server);
    const result = await transport.sendMail({ ...message, from });

    const refused = result.rejected.concat(result.pending ?? []).filter(Boolean);
    if (refused.length > 0) {
      return { ok: false, reason: `Refusé par le serveur d’envoi (${refused.join(', ')}).` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
