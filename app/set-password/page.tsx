'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

function getRecoveryParams() {
  if (typeof window === 'undefined') {
    return {
      hashParams: new URLSearchParams(),
      searchParams: new URLSearchParams(),
    }
  }

  return {
    hashParams: new URLSearchParams(window.location.hash.replace(/^#/, '')),
    searchParams: new URLSearchParams(window.location.search),
  }
}

function hasRecoveryParams() {
  const { hashParams, searchParams } = getRecoveryParams()

  return hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery'
}

export default function SetPasswordPage() {
  const router = useRouter()
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    let subscriptionCleanup: (() => void) | undefined

    const markReady = (sessionEmail?: string | null) => {
      if (!mounted) {
        return
      }

      setError(null)
      setEmail(sessionEmail ?? '')
      setReady(true)
      setInitializing(false)

      if (window.location.hash || window.location.search) {
        window.history.replaceState({}, '', '/set-password')
      }
    }

    const init = async () => {
      const expectsRecovery = hasRecoveryParams()
      const { hashParams, searchParams } = getRecoveryParams()
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const code = searchParams.get('code')

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          markReady(session?.user?.email)
          return
        }

        if (event === 'SIGNED_IN' && expectsRecovery) {
          markReady(session?.user?.email)
        }
      })
      subscriptionCleanup = () => {
        subscription.unsubscribe()
      }

      if (accessToken && refreshToken) {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (!mounted) {
          return
        }

        if (sessionError || !data.session) {
          setReady(false)
          setInitializing(false)
          setError('El enlace para configurar la contrasena no es valido o ya expiro. Solicita uno nuevo.')
          return
        }

        markReady(data.session.user?.email)
        return
      }

      if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (!mounted) {
          return
        }

        if (exchangeError || !data.session) {
          setReady(false)
          setInitializing(false)
          setError('El enlace para configurar la contrasena no es valido o ya expiro. Solicita uno nuevo.')
          return
        }

        markReady(data.session.user?.email)
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) {
        return
      }

      if (session) {
        markReady(session.user?.email)
      } else {
        setReady(false)
        setInitializing(false)
        setError(
          expectsRecovery
            ? 'El enlace para configurar la contrasena no es valido o ya expiro. Solicita uno nuevo.'
            : 'No se encontro una solicitud valida para configurar contrasena.'
        )
      }

    }

    void init()

    return () => {
      mounted = false
      subscriptionCleanup?.()
    }
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!password || password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contrasenas no coinciden.')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    await supabase.auth.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-semibold text-slate-800">Configurar contrasena</h1>
        <p className="mb-6 text-center text-sm text-slate-500">
          Define tu contrasena para completar el acceso a VouChek.
        </p>

        {initializing ? (
          <p className="text-sm text-slate-600">Validando enlace...</p>
        ) : !ready ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Correo electronico</label>
              <input
                type="email"
                value={email}
                autoComplete="email"
                disabled
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Nueva contrasena</label>
              <input
                type="password"
                name="newPassword"
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Confirmar contrasena</label>
              <input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar contrasena'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}