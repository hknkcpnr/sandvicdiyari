import './globals.css';
import ReduxProvider from '@/store/ReduxProvider';

export const metadata = {
  metadataBase: new URL('https://sandwichdiyari.com'),
  title: 'Sandviç Diyarı Torbalı | Maxi Karışık, Kasap Köfte & Gece 03:00 Paket Servis',
  description: "İzmir Torbalı'da gece 03:00'e kadar kapınıza sıcak paket servis! Özel ekmekli Maxi Karışık, Kasap Köfte, Megzi Dürüm, Ayvalık Tostu ve avantajlı menüler.",
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png?v=2', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/icon-192.png?v=2',
    apple: '/icon-192.png?v=2',
  },
  openGraph: {
    title: 'Sandviç Diyarı Torbalı | Gece 03:00 Paket Servis',
    description: "Torbalı içi kapıya sıcak teslimat. Maxi Karışık, Kasap Köfte, Ayvalık Tostu.",
    url: 'https://sandwichdiyari.com',
    siteName: 'Sandviç Diyarı',
    images: [
      {
        url: '/images/hero_banner.jpg',
        width: 1200,
        height: 630,
        alt: 'Sandviç Diyarı Torbalı Menü',
      },
    ],
    locale: 'tr_TR',
    type: 'website',
  },
};

export const viewport = {
  themeColor: '#ea580c',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body className="bg-stone-50 text-stone-800 antialiased selection:bg-brand-500 selection:text-white min-h-screen flex flex-col">
        <ReduxProvider>
          {children}
        </ReduxProvider>
      </body>
    </html>
  );
}
