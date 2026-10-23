import type { Metadata, Viewport } from 'next';
import { archivo, plexMono } from '@/lib/fonts';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.neotericlp.com.ng'),
  title: {
    default: 'Neoteric LP | Legal Practitioners & Consultants in Nigeria',
    template: '%s | Neoteric LP',
  },
  description:
    'Neoteric LP is a Nigerian law firm providing innovative legal solutions across ' +
    'corporate and commercial law, dispute resolution, property law, energy law, ' +
    'technology law, and other areas of legal practice.',
  keywords: [
    'Law Firm Nigeria',
    'Law Firm Abuja',
    'Corporate Lawyers Nigeria',
    'Commercial Law',
    'Property Law',
    'Energy Law',
    'Technology Law',
    'Dispute Resolution',
    'Neoteric LP',
  ],
  authors: [{ name: 'Neoteric LP' }],
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    siteName: 'Neoteric LP',
    images: ['/images/neotericHor_1200by628.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@Neoteric_LP',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  alternates: {
    canonical: '/',
    types: { 'application/rss+xml': '/feed.xml' },
  },
};

export const viewport: Viewport = {
  themeColor: '#255859',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable}`}>
      <head>
        {/*
          Material Symbols is the one font still loaded from Google. It is a
          variable icon font whose ligature lookup `next/font` cannot
          preprocess, so it comes over the wire — preconnected so the
          handshake is not on the critical path.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          `display=block` rather than the usual `swap`: an icon here is a
          ligature, so a fallback face renders the literal text
          "arrow_forward" in the button until the font arrives. A brief blank
          is better than that.

          Both rules below are disabled knowingly. `no-page-custom-font`
          fires on any <link> font outside `pages/_document`, which this root
          layout is the App Router equivalent of.
        */}
        {/* eslint-disable-next-line @next/next/google-font-display, @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0..1,0&display=block"
          rel="stylesheet"
        />

        {/*
          Hides icon ligatures until the font is ready.

          An icon here is the text "arrow_forward" styled with a font that
          turns it into an arrow. Before that font arrives the raw word shows,
          which is how a button ends up reading "upload_file". `font-display:
          block` covers the first few seconds; this covers the rest, including
          a network where the font never arrives at all.

          The class is only ever added by this script, so a browser without
          `document.fonts` — or with JavaScript off — never reaches a state
          where the icons are hidden with nothing to replace them. The timeout
          is the same guarantee for a promise that never settles.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(!document.fonts||!document.fonts.load)return;
var r=document.documentElement;r.classList.add('fonts-pending');
var show=function(){r.classList.remove('fonts-pending')};
document.fonts.load("20px 'Material Symbols Rounded'").then(show).catch(show);
setTimeout(show,3000);}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
