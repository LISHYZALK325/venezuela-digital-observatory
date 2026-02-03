import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://venezueladigitalobservatory.com'),
  title: {
    default: 'Venezuela Digital Observatory',
    template: '%s | Venezuela Digital Observatory',
  },
  description: 'Real-time monitoring of Venezuelan government websites (.gob.ve and .mil.ve). Track availability, SSL certificates, and server status.',
  keywords: ['Venezuela', 'government', 'monitoring', 'transparency', 'open data', 'digital observatory', 'gob.ve', 'mil.ve'],
  authors: [{ name: 'Giuseppe Gangi', url: 'https://ggangi.com' }],
  creator: 'Giuseppe Gangi',
  publisher: 'Giuseppe Gangi',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/og-image.png',
  },
  openGraph: {
    title: 'Venezuela Digital Observatory',
    description: 'Real-time monitoring of Venezuelan government websites (.gob.ve and .mil.ve). Track availability, SSL certificates, and server status.',
    url: 'https://venezueladigitalobservatory.com',
    siteName: 'Venezuela Digital Observatory',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Venezuela Digital Observatory',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Venezuela Digital Observatory',
    description: 'Real-time monitoring of Venezuelan government websites (.gob.ve and .mil.ve). Track availability, SSL certificates, and server status.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
