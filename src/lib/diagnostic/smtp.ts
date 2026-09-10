import type { Point } from './etat';

/**
 * Essai RÉEL de connexion au serveur d'envoi.
 *
 * ── Pourquoi constater la variable ne suffit pas ─────────────────────────
 *
 * Le diagnostic sait dire « EMAIL_SERVER est définie ». Il ne savait pas dire
 * si elle MARCHE — et c'est exactement la question posée quand le formulaire
 * répond correctement et qu'aucun courriel n'arrive.
 *
 * Entre les deux il y a toute la place pour : un mot de passe faux, une boîte
 * qui n'existe pas encore, un port fermé par l'hébergeur, un certificat que
 * le serveur refuse, un `/` dans le mot de passe qui a détourné la connexion
 * vers votre propre domaine. Aucun de ces cas ne se voit dans la valeur de la
 * variable ; tous se voient en ouvrant la connexion.
 *
 * `verify()` de nodemailer fait exactement cela : il se connecte, négocie
 * TLS, s'authentifie, et n'envoie rien.
 */
export async function essaiSmtp(url: string | undefined, from: string | undefined): Promise<Point> {
  if (!url) {
    return {
      sujet: 'Connexion au serveur d’envoi',
      etat: 'absent',
      constat: 'EMAIL_SERVER est absente : rien à tester.',
      remede: 'Définissez EMAIL_SERVER, puis relancez ce diagnostic.',
    };
  }

  let hote = 'illisible';
  let utilisateur = '';
  try {
    const analysee = new URL(url);
    hote = analysee.host;
    utilisateur = decodeURIComponent(analysee.username);
  } catch {
    return {
      sujet: 'Connexion au serveur d’envoi',
      etat: 'absent',
      constat: 'EMAIL_SERVER n’est pas une URL lisible.',
      remede: 'Forme attendue : smtp://UTILISATEUR:MOTDEPASSE@smtp.hostinger.com:587',
    };
  }

  try {
    const { createTransport } = await import('nodemailer');
    const transport = createTransport(url, {
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 8_000,
    });

    await transport.verify();
    transport.close();

    /*
      La connexion marche. Reste un piège que `verify()` ne voit pas : un
      serveur d'envoi refuse souvent d'expédier « au nom de » une adresse
      qui n'est pas celle du compte authentifié. Le message part alors en
      erreur, ou en indésirable chez le destinataire.
    */
    const memeAdresse =
      from !== undefined && utilisateur.toLowerCase() === from.trim().toLowerCase();

    return memeAdresse || from === undefined
      ? {
          sujet: 'Connexion au serveur d’envoi',
          etat: 'ok',
          constat: `Connexion et authentification réussies sur ${hote}. Le serveur accepte nos identifiants.`,
          remede: null,
        }
      : {
          sujet: 'Connexion au serveur d’envoi',
          etat: 'attention',
          constat: `Connexion réussie sur ${hote}, mais l’identifiant SMTP et EMAIL_FROM ne sont pas la même adresse. Beaucoup de serveurs refusent d’expédier au nom d’une autre adresse, ou le message part en indésirable.`,
          remede: 'Faites correspondre EMAIL_FROM à l’adresse du compte SMTP.',
        };
  } catch (error) {
    /*
      Le message du serveur est rendu tel quel : c'est lui qui nomme la cause
      (« Invalid login », « connect ECONNREFUSED », « certificate »), et le
      reformuler perdrait l'information. Il ne contient pas le mot de passe —
      nodemailer ne l'y met pas — mais on le retire par précaution, parce que
      cette sortie est faite pour être recopiée.
      */
    const brut = error instanceof Error ? error.message : String(error);
    const motDePasse = motDePasseDe(url);
    const propre = motDePasse ? brut.split(motDePasse).join('•••') : brut;

    return {
      sujet: 'Connexion au serveur d’envoi',
      etat: 'absent',
      constat: `Impossible de se connecter à ${hote}. Le serveur répond : « ${propre.slice(0, 300)} »`,
      remede: remedePour(propre),
    };
  }
}

function motDePasseDe(url: string): string | null {
  try {
    const mot = decodeURIComponent(new URL(url).password);
    return mot.length > 0 ? mot : null;
  } catch {
    return null;
  }
}

/** Traduit les erreurs les plus fréquentes en geste à faire. */
function remedePour(message: string): string {
  const m = message.toLowerCase();

  if (m.includes('invalid login') || m.includes('authentication') || m.includes('535')) {
    return (
      'Identifiants refusés. Vérifiez que la boîte existe vraiment chez l’hébergeur, que le mot de passe est le bon, ' +
      'et que l’identifiant est l’adresse complète encodée : contact%40lunamarea.fr — le « @ » de l’identifiant doit devenir %40.'
    );
  }
  if (m.includes('econnrefused') || m.includes('etimedout') || m.includes('timeout')) {
    return 'Le port ne répond pas. Essayez 587 (STARTTLS) ou 465 (smtps://). Certains hébergeurs bloquent le 25.';
  }
  if (m.includes('certificate') || m.includes('self-signed') || m.includes('tls')) {
    return 'Négociation TLS refusée. Sur le port 465 utilisez smtps:// ; sur le 587, smtp://.';
  }
  if (m.includes('enotfound') || m.includes('getaddrinfo')) {
    return 'Le nom du serveur est introuvable. Un « / », « ? », « # » ou « % » dans le MOT DE PASSE coupe l’URL et détourne la connexion : encodez-les (%2F %3F %23 %25) ou changez le mot de passe.';
  }
  return 'Relisez EMAIL_SERVER : smtp://UTILISATEUR:MOTDEPASSE@smtp.hostinger.com:587, avec le « @ » de l’identifiant encodé en %40.';
}
