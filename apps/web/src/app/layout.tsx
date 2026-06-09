import './globals.css';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'AlphaStryk | High-Performance Athletic Customization',
    template: '%s | AlphaStryk',
  },
  description: 'Premium sports clothing and customized 3D designer configurations. Create custom team uniforms in real-time, compute GST-compliant tax invoices, and track orders carrier-wide.',
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'AlphaStryk | Custom 3D Sports Apparel Configurator',
    description: 'Design and customize premium athletic team wear in real-time with our advanced 3D customizer canvas.',
    url: 'https://alphastryk.com',
    siteName: 'AlphaStryk',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AlphaStryk | Custom 3D Sports Apparel Configurator',
    description: 'Design and customize premium athletic team wear in real-time with our advanced 3D customizer canvas.',
    creator: '@alphastryk',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <script src="https://accounts.google.com/gsi/client" async defer></script>
      </head>
      <body className="bg-gradient-mesh min-h-screen text-gray-100 flex flex-col font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
