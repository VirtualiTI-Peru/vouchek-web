'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

interface NavSignOutButtonProps {
  displayName?: string
}

export function NavSignOutButton({ displayName }: NavSignOutButtonProps) {
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
    <div className="flex items-center gap-3">
      {displayName && (
        <span className="text-sm text-slate-600">{displayName}</span>
      )}
      <button
        onClick={handleSignOut}
        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Cerrar sesion
      </button>
    </div>
  )
}
