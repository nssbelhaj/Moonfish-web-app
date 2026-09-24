import type { ReactNode } from 'react';

/**
 * Les illustrations des guides : des schémas SVG, pas des photos.
 *
 * ─── Pourquoi du SVG dessiné ici, et pas des images ───────────────────────
 *
 * Un schéma de montage doit être lisible en plein soleil et de nuit sous une
 * frontale rouge : il prend donc les COULEURS DU THÈME (`var(--fg)`,
 * `var(--accent)`, `var(--water)`) et se retourne avec lui, ce qu'aucune
 * image ne ferait. Il se redimensionne sans flou, pèse deux kilo-octets, et
 * ne charge rien depuis un tiers — la page de confidentialité le promet.
 *
 * Chaque schéma porte un `<title>` (UNE chaîne, exigence de React 19) et une
 * légende sous la figure : ce que le schéma montre se lit aussi sans le voir.
 *
 * Les proportions sont schématiques, et le disent : un montage n'est pas à
 * l'échelle, la règle des douzièmes est un principe, pas une table.
 */

const TRAIT = 'var(--fg)';
const DOUX = 'var(--fg-muted)';
const ACCENT = 'var(--accent)';
const EAU = 'var(--water)';
const SABLE = 'var(--surface-2)';
const CARTE = 'var(--card)';

function Cadre({
  titre,
  viewBox,
  children,
}: {
  titre: string;
  viewBox: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox={viewBox}
      className="block h-auto w-full"
      role="img"
      aria-label={titre}
      fontFamily="var(--font-archivo), Archivo, system-ui, sans-serif"
      fontSize={13}
      fill={TRAIT}
    >
      <title>{titre}</title>
      {children}
    </svg>
  );
}

/** Un hameçon stylisé, pointe vers la droite, ancré en (x, y) par l'œillet. */
function Hamecon({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x},${y} v22 a9,9 0 0 0 18,0 v-6`}
      fill="none"
      stroke={TRAIT}
      strokeWidth={2}
      strokeLinecap="round"
    />
  );
}

/** Un appât (ver) enfilé sur l'hameçon. */
function Ver({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x - 2},${y + 4} c 6,-6 8,10 14,4 s 8,-10 10,0`}
      fill="none"
      stroke={ACCENT}
      strokeWidth={4}
      strokeLinecap="round"
    />
  );
}

function Etiquette({ x, y, children, ancre = 'start' }: { x: number; y: number; children: string; ancre?: 'start' | 'middle' | 'end' }) {
  return (
    <text x={x} y={y} textAnchor={ancre} fill={DOUX}>
      {children}
    </text>
  );
}

export function MontageDeuxEmpiles() {
  return (
    <Cadre titre="Montage à deux empiles : arraché, émerillon, corps de ligne avec deux dérivations portant chacune un hameçon esché, plomb grappin en bas" viewBox="0 0 600 360">
      {/* Corps de ligne */}
      <line x1={300} y1={20} x2={300} y2={300} stroke={TRAIT} strokeWidth={2.5} />
      {/* Arraché, plus épais */}
      <line x1={300} y1={20} x2={300} y2={70} stroke={TRAIT} strokeWidth={5} />
      <Etiquette x={315} y={45}>Arraché 60–70/100, 10 à 15 m</Etiquette>
      {/* Émerillon */}
      <circle cx={300} cy={80} r={7} fill={CARTE} stroke={TRAIT} strokeWidth={2} />
      <Etiquette x={315} y={85}>Émerillon à agrafe</Etiquette>
      <Etiquette x={285} y={175} ancre="end">Corps 50/100, 1,20 m</Etiquette>
      {/* Empile 1 */}
      <line x1={300} y1={130} x2={190} y2={130} stroke={TRAIT} strokeWidth={1.5} />
      <circle cx={300} cy={130} r={4} fill={TRAIT} />
      <Hamecon x={190} y={130} />
      <Ver x={192} y={140} />
      <Etiquette x={178} y={122} ancre="end">Empile 30–50 cm</Etiquette>
      <Etiquette x={178} y={140} ancre="end">hameçon aberdeen n° 1</Etiquette>
      {/* Empile 2 */}
      <line x1={300} y1={215} x2={410} y2={215} stroke={TRAIT} strokeWidth={1.5} />
      <circle cx={300} cy={215} r={4} fill={TRAIT} />
      <Hamecon x={410} y={215} />
      <Ver x={412} y={225} />
      <Etiquette x={440} y={260}>Seconde empile, décalée :</Etiquette>
      <Etiquette x={440} y={278}>les deux ne s’emmêlent pas</Etiquette>
      {/* Plomb grappin */}
      <ellipse cx={300} cy={318} rx={14} ry={24} fill={DOUX} />
      <g stroke={TRAIT} strokeWidth={2} fill="none" strokeLinecap="round">
        <path d="M300,300 l-22,-30" />
        <path d="M300,300 l22,-30" />
        <path d="M300,300 l-12,-34" />
        <path d="M300,300 l12,-34" />
      </g>
      <Etiquette x={325} y={330}>Plomb grappin 100–150 g</Etiquette>
      <Etiquette x={325} y={348}>(les branches s’ancrent dans le sable)</Etiquette>
    </Cadre>
  );
}

export function MontageCoulissant() {
  return (
    <Cadre titre="Montage coulissant : le plomb coulisse librement sur le corps de ligne, arrêté par une perle et un émerillon, puis une empile longue et fine porte l’hameçon" viewBox="0 95 600 170">
      <line x1={40} y1={150} x2={560} y2={150} stroke={TRAIT} strokeWidth={2.5} />
      <path d="M54,140 L42,150 L54,160" fill="none" stroke={TRAIT} strokeWidth={2.5} strokeLinecap="round" />
      {/* Plomb coulissant avec son œillet */}
      <ellipse cx={150} cy={172} rx={18} ry={28} fill={DOUX} />
      <circle cx={150} cy={150} r={7} fill="none" stroke={TRAIT} strokeWidth={2} />
      <Etiquette x={150} y={230} ancre="middle">Plomb coulissant 60–100 g</Etiquette>
      <Etiquette x={150} y={248} ancre="middle">le poisson tire sans sentir le poids</Etiquette>
      {/* Perle et émerillon */}
      <circle cx={260} cy={150} r={6} fill={ACCENT} />
      <circle cx={285} cy={150} r={7} fill={CARTE} stroke={TRAIT} strokeWidth={2} />
      <Etiquette x={272} y={120} ancre="middle">Perle + émerillon</Etiquette>
      {/* Empile longue et fine */}
      <line x1={292} y1={150} x2={520} y2={150} stroke={TRAIT} strokeWidth={1.2} />
      <Etiquette x={400} y={135} ancre="middle">Empile 1 à 1,50 m, fil fin (25–30/100)</Etiquette>
      <Hamecon x={520} y={150} />
      <Ver x={522} y={160} />
      <Etiquette x={62} y={132}>vers la canne</Etiquette>
    </Cadre>
  );
}

export function MontageSoutenirRoche() {
  return (
    <Cadre titre="Montage à soutenir sur la roche : une empile courte au-dessus d’un plomb attaché par un fil plus faible, pour ne perdre que le plomb quand il se coince" viewBox="0 0 600 340">
      {/* Roche */}
      <path d="M0,340 L0,250 C60,230 90,290 150,260 C210,230 250,300 320,270 C380,250 420,300 480,280 C540,260 570,300 600,290 L600,340 Z" fill={SABLE} stroke={DOUX} />
      <Etiquette x={40} y={320}>Roche et algues</Etiquette>
      {/* Ligne */}
      <line x1={300} y1={10} x2={300} y2={200} stroke={TRAIT} strokeWidth={2.5} />
      <circle cx={300} cy={60} r={7} fill={CARTE} stroke={TRAIT} strokeWidth={2} />
      {/* Empile courte */}
      <line x1={300} y1={110} x2={380} y2={110} stroke={TRAIT} strokeWidth={1.5} />
      <circle cx={300} cy={110} r={4} fill={TRAIT} />
      <Hamecon x={380} y={110} />
      <path d="M382,116 a7,7 0 1 0 14,0 a7,7 0 1 0 -14,0" fill={ACCENT} />
      <Etiquette x={410} y={92}>Empile 40–60 cm,</Etiquette>
      <Etiquette x={410} y={110}>hameçon fort, crabe mou</Etiquette>
      <Etiquette x={410} y={128}>ou moule ficelée</Etiquette>
      {/* Fil faible vers le plomb */}
      <line x1={300} y1={200} x2={300} y2={250} stroke={DOUX} strokeWidth={1} strokeDasharray="4 3" />
      <Etiquette x={315} y={230}>Fil plus faible : « plomb perdu »</Etiquette>
      <ellipse cx={300} cy={268} rx={12} ry={18} fill={DOUX} />
      <Etiquette x={315} y={275}>Plomb 60–100 g</Etiquette>
      <Etiquette x={282} y={175} ancre="end">Le plomb se coince : seul le</Etiquette>
      <Etiquette x={282} y={193} ancre="end">fil faible casse, le poisson reste</Etiquette>
    </Cadre>
  );
}

export function RegleDesDouziemes() {
  /* Hauteur d'eau sur les six heures d'une montante : cumul 1, 3, 6, 9, 11, 12. */
  const cumuls = [0, 1, 3, 6, 9, 11, 12];
  const x0 = 60;
  const largeur = 480;
  const yBas = 240;
  const hauteur = 180;
  const points = cumuls.map((c, i) => [x0 + (i * largeur) / 6, yBas - (c / 12) * hauteur] as const);
  const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  return (
    <Cadre titre="La règle des douzièmes : sur six heures de montante, l’eau monte d’un douzième la première heure, deux la deuxième, trois la troisième et la quatrième, puis deux et un — la moitié de la montée se joue dans les deux heures centrales" viewBox="0 0 600 300">
      {/* Bandes horaires */}
      {[1, 2, 3, 3, 2, 1].map((n, i) => (
        <g key={i}>
          <rect x={x0 + (i * largeur) / 6} y={40} width={largeur / 6} height={200} fill={i === 2 || i === 3 ? EAU : 'none'} opacity={i === 2 || i === 3 ? 0.25 : 1} />
          <text x={x0 + (i * largeur) / 6 + largeur / 12} y={270} textAnchor="middle" fill={DOUX}>
            {`${i + 1}ᵉ h · ${n}/12`}
          </text>
        </g>
      ))}
      {/* Eau sous la courbe */}
      <path d={`${d} L${x0 + largeur},${yBas} L${x0},${yBas} Z`} fill={EAU} opacity={0.45} />
      <path d={d} fill="none" stroke={ACCENT} strokeWidth={3} strokeLinejoin="round" />
      {points.map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r={4} fill={ACCENT} />
      ))}
      <Etiquette x={x0} y={30}>Basse mer</Etiquette>
      <Etiquette x={x0 + largeur} y={30} ancre="end">Pleine mer</Etiquette>
      <text x={300} y={216} textAnchor="middle" fill={TRAIT}>Les deux heures centrales :</text>
      <text x={300} y={234} textAnchor="middle" fill={TRAIT}>la moitié du marnage</text>
      <Etiquette x={300} y={295} ancre="middle">La descendante suit la même règle, à l’envers</Etiquette>
    </Cadre>
  );
}

export function BaineMontanteDescendante() {
  return (
    <Cadre titre="Une baïne vue du ciel : le banc de sable ferme un bassin qui se vide par une passe à la descendante ; le courant de sortie concentre le poisson en aval de la passe, et emporte le baigneur" viewBox="0 0 600 340">
      {/* Mer */}
      <rect x={0} y={0} width={600} height={200} fill={EAU} opacity={0.5} />
      {/* Plage */}
      <path d="M0,340 L0,220 C100,200 200,235 300,225 C400,215 500,240 600,220 L600,340 Z" fill={SABLE} />
      {/* Banc de sable */}
      <path d="M120,205 C200,170 380,170 470,205 L470,225 C380,195 200,195 120,225 Z" fill={SABLE} stroke={DOUX} />
      <Etiquette x={300} y={188} ancre="middle">Banc de sable (la barre)</Etiquette>
      {/* Bassin */}
      <Etiquette x={300} y={222} ancre="middle">Bassin de la baïne</Etiquette>
      {/* Passe : trou dans le banc, à droite */}
      <rect x={455} y={165} width={40} height={65} fill={EAU} opacity={0.7} />
      <Etiquette x={505} y={200}>La passe</Etiquette>
      {/* Courant de sortie */}
      <g stroke={ACCENT} strokeWidth={3} fill="none" strokeLinecap="round">
        <path d="M300,232 C380,232 430,215 475,195 C485,180 490,150 490,110" />
        <path d="M483,127 L490,110 L497,126" />
      </g>
      <Etiquette x={475} y={140} ancre="end">Courant de sortie</Etiquette>
      <Etiquette x={475} y={158} ancre="end">à la descendante</Etiquette>
      {/* Postes */}
      <circle cx={520} cy={90} r={7} fill={ACCENT} stroke={CARTE} strokeWidth={2} />
      <Etiquette x={505} y={95} ancre="end">Poste : en aval de la passe</Etiquette>
      <circle cx={80} cy={250} r={7} fill={TRAIT} stroke={CARTE} strokeWidth={2} />
      <Etiquette x={95} y={255}>Vous, pieds au sec</Etiquette>
      <Etiquette x={20} y={320}>Descendante : ne jamais entrer dans l’eau au-dessus du genou près de la passe</Etiquette>
    </Cadre>
  );
}

export function LireUnePlage() {
  return (
    <Cadre titre="Une plage de sable vue en coupe, à basse mer : le haut de plage, la première barre, la fosse derrière elle, la seconde barre et le large — le poisson chasse dans la fosse et sur le bord des barres, pas au large" viewBox="0 0 600 300">
      {/* Profil du sable */}
      <path d="M0,110 C80,120 110,150 160,160 C210,170 230,150 270,150 C310,150 330,190 380,200 C430,210 450,195 490,200 C540,205 570,215 600,220 L600,300 L0,300 Z" fill={SABLE} stroke={DOUX} />
      {/* Eau à basse mer */}
      <path d="M180,168 C230,176 260,160 300,162 C340,166 360,200 600,200 L600,215 L0,215 Z" fill={EAU} opacity={0.5} />
      <line x1={0} y1={215} x2={600} y2={215} stroke={EAU} strokeWidth={2} />
      <Etiquette x={10} y={100}>Haut de plage</Etiquette>
      <Etiquette x={255} y={140} ancre="middle">1ʳᵉ barre</Etiquette>
      <Etiquette x={470} y={190} ancre="middle">2ᵉ barre</Etiquette>
      <Etiquette x={370} y={245} ancre="middle">Fosse : c’est ici</Etiquette>
      <Etiquette x={590} y={240} ancre="end">Le large</Etiquette>
      <Etiquette x={200} y={190} ancre="middle">Chenal</Etiquette>
      {/* Poissons dans la fosse */}
      <g fill={ACCENT}>
        <path d="M350,225 l14,-6 l-14,-6 l4,6 z" />
        <path d="M395,232 l14,-6 l-14,-6 l4,6 z" />
      </g>
      {/* Lancer */}
      <g stroke={TRAIT} strokeWidth={1.5} fill="none" strokeDasharray="5 4">
        <path d="M40,90 C150,20 300,60 370,215" />
      </g>
      <Etiquette x={300} y={42}>Lancer dans la fosse,</Etiquette>
      <Etiquette x={300} y={60}>pas par-dessus</Etiquette>
      <Etiquette x={300} y={290} ancre="middle">À pleine mer, tout ceci est sous l’eau : la plage se lit à basse mer</Etiquette>
    </Cadre>
  );
}

export function VentDeMerDeTerre() {
  return (
    <Cadre titre="Le vent lu depuis l’orientation du spot : de mer quand il souffle du large vers la plage, de terre quand il vient de derrière, de travers quand il longe la côte" viewBox="0 0 600 340">
      <rect x={0} y={0} width={600} height={170} fill={EAU} opacity={0.5} />
      <path d="M0,340 L0,175 C150,160 450,185 600,170 L600,340 Z" fill={SABLE} />
      <Etiquette x={300} y={30} ancre="middle">Le large</Etiquette>
      <Etiquette x={300} y={325} ancre="middle">La terre</Etiquette>
      <circle cx={300} cy={185} r={8} fill={TRAIT} stroke={CARTE} strokeWidth={2} />
      <Etiquette x={315} y={190}>Le spot, face au large</Etiquette>
      <g strokeWidth={4} fill="none" strokeLinecap="round">
        <path d="M300,60 L300,150" stroke={ACCENT} />
        <path d="M290,138 L300,152 L310,138" stroke={ACCENT} />
        <path d="M300,300 L300,215" stroke={DOUX} />
        <path d="M290,227 L300,213 L310,227" stroke={DOUX} />
        <path d="M80,185 L200,185" stroke={TRAIT} />
        <path d="M188,175 L202,185 L188,195" stroke={TRAIT} />
      </g>
      <Etiquette x={315} y={105}>Vent de mer : brasse le bord,</Etiquette>
      <Etiquette x={315} y={123}>trouble l’eau — le score aime</Etiquette>
      <Etiquette x={315} y={270}>Vent de terre : mer plate, eau claire,</Etiquette>
      <Etiquette x={315} y={288}>lancer facile, poisson au large</Etiquette>
      <Etiquette x={80} y={165}>Vent de travers</Etiquette>
    </Cadre>
  );
}

export function MontageLeurre() {
  return (
    <Cadre titre="Ligne de lancer-ramener : tresse fine, nœud de raccord, bas de ligne en fluorocarbone d’un à deux mètres, agrafe, et un leurre souple monté sur tête plombée" viewBox="0 0 600 220">
      <line x1={30} y1={110} x2={230} y2={110} stroke={ACCENT} strokeWidth={2} strokeDasharray="6 3" />
      <Etiquette x={130} y={90} ancre="middle">Tresse 12–15/100</Etiquette>
      <circle cx={240} cy={110} r={6} fill={TRAIT} />
      <Etiquette x={240} y={140} ancre="middle">Nœud (FG ou Albright)</Etiquette>
      <line x1={246} y1={110} x2={430} y2={110} stroke={TRAIT} strokeWidth={1.5} />
      <Etiquette x={340} y={90} ancre="middle">Fluorocarbone 30–40/100, 1 à 2 m</Etiquette>
      <path d="M430,104 h14 v12 h-14 z" fill="none" stroke={TRAIT} strokeWidth={2} />
      <Etiquette x={426} y={140} ancre="end">Agrafe</Etiquette>
      {/* Tête plombée + leurre souple */}
      <circle cx={462} cy={110} r={9} fill={DOUX} />
      <path d="M470,104 C510,96 545,100 575,110 C545,120 510,124 470,116 Z" fill={ACCENT} />
      <path d="M575,110 l14,-8 v16 z" fill={ACCENT} />
      <path d="M470,116 v12 a8,8 0 0 0 16,0 v-4" fill="none" stroke={TRAIT} strokeWidth={2} />
      <Etiquette x={520} y={150} ancre="middle">Leurre souple 10–12 cm</Etiquette>
      <Etiquette x={520} y={168} ancre="middle">tête plombée 7–14 g</Etiquette>
      <Etiquette x={30} y={200}>Le fluorocarbone est invisible et résiste à la roche ; la tresse, elle, se coupe sur un bloc.</Etiquette>
    </Cadre>
  );
}

/** Le registre : nom dans le markdown → composant et légende. */
export const ILLUSTRATIONS: Record<string, { Composant: () => ReactNode; legende: string }> = {
  'montage-deux-empiles': {
    Composant: MontageDeuxEmpiles,
    legende: 'Le montage à deux empiles, schématique et pas à l’échelle : l’arraché encaisse le lancer, l’émerillon empêche le vrillage, les deux empiles décalées ne s’emmêlent pas, le grappin tient dans le courant.',
  },
  'montage-coulissant': {
    Composant: MontageCoulissant,
    legende: 'Le montage coulissant : le plomb glisse sur la ligne, le poisson prend l’appât sans sentir le poids. C’est le montage de la sole et de la daurade méfiante, par mer plate.',
  },
  'montage-soutenir-roche': {
    Composant: MontageSoutenirRoche,
    legende: 'Le montage à soutenir sur la roche : le plomb est attaché par un fil plus faible que le reste. Quand il se coince — et il se coince —, on ne perd que lui.',
  },
  'regle-des-douziemes': {
    Composant: RegleDesDouziemes,
    legende: 'La règle des douzièmes : la montée n’est pas régulière. Les deux heures centrales font la moitié du marnage — c’est là qu’on se fait surprendre sur un estran.',
  },
  'baine-montante-descendante': {
    Composant: BaineMontanteDescendante,
    legende: 'Une baïne vue du ciel. À la descendante, le bassin se vide par la passe ; le courant de sortie concentre le poisson en aval — et emporte quiconque a de l’eau au-dessus du genou.',
  },
  'lire-une-plage': {
    Composant: LireUnePlage,
    legende: 'Une plage de sable en coupe, à basse mer : barres, chenal, fosse. À pleine mer tout est sous l’eau et le poisson chasse dans la fosse, à vingt mètres — pas au large.',
  },
  'vent-de-mer-de-terre': {
    Composant: VentDeMerDeTerre,
    legende: 'Le même vent n’a pas le même sens selon l’orientation du spot : de mer, il brasse le bord ; de terre, il aplatit ; de travers, il dérive la ligne.',
  },
  'montage-leurre': {
    Composant: MontageLeurre,
    legende: 'La ligne de lancer-ramener : tresse pour la distance et la sensibilité, fluorocarbone pour la discrétion et la roche, et un leurre souple qui nage bas.',
  },
};

export function Illustration({ nom }: { nom: string }) {
  const entree = ILLUSTRATIONS[nom];
  if (!entree) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[guides] illustration inconnue : ${nom}`);
    }
    return null;
  }
  const { Composant, legende } = entree;
  return (
    <figure className="surface my-8 p-4 font-sans">
      <Composant />
      <figcaption className="mt-3 text-meta text-fg-muted">{legende}</figcaption>
    </figure>
  );
}
