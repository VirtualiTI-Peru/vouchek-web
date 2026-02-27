import type { Metadata } from 'next';
import { ThemeProvider } from '@/providers/theme-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'VouChek',
  description: 'VouChek - Digitalización de comprobantes de pago',
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
