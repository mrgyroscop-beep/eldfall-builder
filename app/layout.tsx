import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Calad Guild — Eldfall Chronicles',
  description: 'Личный ростер-билдер и журнал матчей Eldfall Chronicles.',
  robots: { index: false, follow: false },
  metadataBase: new URL('https://calad-guild-eldfall.mrgyroscop.chatgpt.site'),
  openGraph: {
    title: 'Calad Guild — Eldfall Chronicles',
    description: 'Личный ростер-билдер и журнал матчей Eldfall Chronicles.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Calad Guild — Eldfall Chronicles',
    description: 'Личный ростер-билдер и журнал матчей Eldfall Chronicles.',
    images: ['/og.png'],
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
