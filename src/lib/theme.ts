/**
 * Valeurs de thème qui NE PEUVENT PAS être des variables CSS.
 *
 * Une balise `<meta name="theme-color">` est lue par le navigateur avant tout
 * rendu, pour teinter sa propre interface : elle n'a pas accès à la cascade et
 * exige donc une couleur littérale. C'est la seule valeur de la palette qui
 * échappe aux deux fichiers de tokens, d'où ce module — pour qu'elle soit
 * trouvable au lieu d'être oubliée dans un coin de `layout.tsx` le jour d'un
 * changement de direction artistique.
 *
 * Doit toujours refléter `--page` du thème sombre.
 */
export const BROWSER_THEME_COLOR = '#0A0B0D';
