'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AcceptInvitePage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [token, setToken] = useState('')

  useEffect(() => {
    let mounted = true

    const init = async () => {
      setError(null)

      const inviteToken = searchParams.get('token')
      if (!inviteToken) {
        if (mounted) {
          setError('No se encontro el token de invitacion.')
          setInitializing(false)
        }
        return
      }

      const res = await fetch(`/api/invitations/resolve?token=${encodeURIComponent(inviteToken)}`)
      const data = await res.json().catch(() => ({}))

      if (!mounted) {
        return
      }

      if (!res.ok) {
        setError(data?.error ?? 'No se pudo validar la invitacion. Solicita un nuevo enlace.')
        setInitializing(false)
        return
      }

      if (!data?.email) {
        setError('No se pudo resolver el correo de la invitacion. Solicita un nuevo enlace.')
        setInitializing(false)
        return
      }

      setToken(inviteToken)
      setEmail(String(data.email))
      setInitializing(false)
    }

    void init()
    return () => {
      mounted = false
    }
  }, [searchParams])

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!firstName.trim() || !lastName.trim()) {
      setError('Ingresa nombre y apellido.')
      return
    }
    if (!password || password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contrasenas no coinciden.')
      return
    }
    if (!token) {
      setError('Invitacion invalida.')
      return
    }

    setLoading(true)

    const completeRes = await fetch('/api/complete-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, firstName, lastName, password }),
    })

    if (!completeRes.ok) {
      const data = await completeRes.json().catch(() => ({}))
      setError(data?.error ?? 'No se pudo completar el registro.')
      setLoading(false)
      return
    }

    router.push('/sign-in')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white dark:bg-[#18191A] p-8 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-semibold text-slate-800">Completa tu registro</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Configura tu cuenta para ingresar a VouChek.</p>

        {initializing ? (
          <p className="text-sm text-slate-600">Validando invitacion...</p>
        ) : (
          <form onSubmit={handleComplete} className="flex flex-col gap-4">
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
              <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
              <input
                type="text"
                name="firstName"
                autoComplete="given-name"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Apellido</label>
              <input
                type="text"
                name="lastName"
                autoComplete="family-name"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                required
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Contrasena</label>
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
              disabled={loading || !email}
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Finalizando...' : 'Finalizar registro'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
