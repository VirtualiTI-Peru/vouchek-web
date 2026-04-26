'use client'

import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Header } from '../../components/layout/Header'

export default function MainShell({ user, children }: { user: any, children: React.ReactNode }) {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <>
      <Header user={user} onSignOut={handleSignOut} />
      {children}
    </>
  )
}
