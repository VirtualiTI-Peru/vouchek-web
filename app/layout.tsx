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
    <html lang="es" suppressHydrationWarning>
      <body className="dashcode-app antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
