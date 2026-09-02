import { handlers } from '@/auth';

/**
 * Points d'accès d'Auth.js : demande de lien, retour du lien, déconnexion.
 *
 * Le pilote MySQL ne fonctionne pas sur le runtime « edge » : cette route doit
 * donc rester en Node. C'est le défaut, mais l'écrire évite qu'une
 * configuration globale ne la bascule sans qu'on s'en aperçoive.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, POST } = handlers;
