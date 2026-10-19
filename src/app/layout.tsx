import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import StoreProvider from '@/store/StoreProvider';
import Toast from '@/components/Toast';
import ServiceWorker from '@/components/ServiceWorker';
import DemoBanner from '@/components/DemoBanner';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Llévalo · Mensajería local', template: '%s · Llévalo' },
  description: 'Mensajería local en San Antonio. Cotiza por millas, pide un repartidor y rastrea tu envío.',
  applicationName: 'Llévalo',
  appleWebApp: { capable: true, title: 'Llévalo', statusBarStyle: 'black-translucent' },
  icons: { apple: '/icons/icon-192.png' }
};

export const viewport: Viewport = {
  themeColor: '#14212B',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap"
        />
      </head>
      <body>
        <StoreProvider>
          <DemoBanner />
          {children}
          <Toast />
          <ServiceWorker />
        </StoreProvider>
      </body>
    </html>
  );
}
