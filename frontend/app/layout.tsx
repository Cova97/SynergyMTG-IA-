import type { Metadata } from 'next';
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
});

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-plex-sans',
  weight: ['400', '500', '600'],
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-plex-mono',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'SynergyMTG',
  description: 'Tu colección de Magic y las sinergias entre tus cartas',
};

// Ya NO incluye el Sidebar aqui — vive en app/(app)/layout.tsx, para
// que login/registro no lo muestren (todavia no hay sesion ahi).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable} font-body`}>
        {children}
      </body>
    </html>
  );
}
