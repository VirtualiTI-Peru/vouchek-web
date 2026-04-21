'use client'

import { Header } from '../../../components/layout/Header'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export function ClientHeader({ user }: { user: any }) {
  const router = useRouter()

  const handleSignOut = async () => {
    console.log('Sign out clicked');
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  return <Header user={user} onSignOut={handleSignOut} />
}