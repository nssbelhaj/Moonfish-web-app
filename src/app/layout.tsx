import type { Metadata, Viewport } from 'next';
import { Archivo, Spectral } from 'next/font/google';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { MobileNav, SiteHeader } from '@/components/layout/SiteHeader';
import { SITE_URL } from '@/lib/routes';
import { BROWSER_THEME_COLOR } from '@/lib/theme';
import './globals.css';

// Les trois familles du handoff §1. `next/font` les auto-héberge : aucune
// requête vers un tiers, aucun décalage de mise en page au chargement.
const archivo = Archivo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-archivo',
  weight: ['400', '500', '600', '700'],
});

const spectral = Spectral({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-spectral',
  weight: ['400', '600'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Moonfish — les meilleurs créneaux de pêche en mer, spot par spot',
    template: '%s · Moonfish',
  },
  description:
    'Score de pêche du bord sur 7 jours, calculé à partir de la marée, du vent, de la houle et des périodes solunaires. Surfcasting, lancer-ramener, rockfishing : 12 spots en France et au Maroc.',
  applicationName: 'Moonfish',
  authors: [{ name: 'Moonfish' }],
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Moonfish',
  },
};

export const viewport: Viewport = {
  themeColor: BROWSER_THEME_COLOR,
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${archivo.variable} ${spectral.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-ctl focus:bg-card focus:px-4 focus:py-3"
        >
          Aller au contenu
        </a>
        <SiteHeader />
        <main id="contenu" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        {/* La barre basse recouvre 56 px : le pied de page doit pouvoir défiler
            au-dessus, sinon ses derniers liens sont inatteignables. */}
        <div className="h-tap-lg md:hidden" aria-hidden="true" />
        <MobileNav />
      </body>
    </html>
  );
}
