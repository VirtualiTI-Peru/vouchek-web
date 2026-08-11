import type { Metadata } from 'next';
import { ThemeProvider } from '@/providers/theme-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vouchek',
  description: 'Vouchek - Digitalización de comprobantes de pago',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Default dark avoids FOUC without an inline <script> (Next 16 forbids scripts in React trees on client nav).
    <html lang="es" className="dark" style={{ colorScheme: 'dark' }} suppressHydrationWarning>
      <body className="dashcode-app antialiased">
        <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>
      </body>
    </html>
  );
}
