import type { Metadata } from 'next'
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Vouchek',
  description: 'Vouchek',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <SignedIn>
            <header className="flex flex-col gap-2">
              <nav className="flex gap-6 items-center justify-center bg-slate-100 py-3 border-b">
                <a href="/receipts" className="font-medium text-slate-700 hover:text-slate-900">Comprobantes</a>
                <a href="/users" className="font-medium text-slate-700 hover:text-slate-900">Usuarios</a>
                <a href="/configuration" className="font-medium text-slate-700 hover:text-slate-900">Configuracion</a>
                <div className="flex justify-end items-center p-4 gap-4 h-16">
                  <UserButton />
                </div>
              </nav>

            </header>
          </SignedIn>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}