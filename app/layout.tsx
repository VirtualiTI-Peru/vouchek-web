import type { Metadata } from 'next'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Geist, Geist_Mono } from 'next/font/google'
import { NavSignOutButton } from './components/NavSignOutButton'
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email

  let displayName: string | undefined = email
  if (user) {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name')
      .eq('user_id', user.id)
      .single()
    const fullName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()
    if (fullName) displayName = fullName
  }

  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {user && (
          <header className="flex flex-col gap-2">
            <nav className="flex gap-6 items-center justify-center bg-slate-100 py-3 border-b">
              <a href="/receipts" className="font-medium text-slate-700 hover:text-slate-900">Comprobantes</a>
              <a href="/users" className="font-medium text-slate-700 hover:text-slate-900">Usuarios</a>
              <a href="/configuration" className="font-medium text-slate-700 hover:text-slate-900">Configuracion</a>
              <div className="flex justify-end items-center p-4 gap-4 h-16">
                <NavSignOutButton displayName={displayName} />
              </div>
            </nav>
          </header>
        )}
        {children}
      </body>
    </html>
  )
}