'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  TextInput,
  PasswordInput,
  Button,
  Paper,
  Title,
  Stack,
  Alert,
  Center,
  Container,
} from '@mantine/core'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <Center h="100vh" bg="gray.0">
      <Container size="md" style={{ maxWidth: 480, width: '100%' }}>
        <Paper withBorder shadow="md" p="xl" radius="md">
          <Title order={2} ta="center" mb="lg">
            Iniciar sesión
          </Title>

          <form onSubmit={handleSignIn}>
            <Stack gap="md">
              <TextInput
                label="Correo electrónico"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
              />

              <PasswordInput
                label="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Tu contraseña"
              />

              {error && (
                <Alert color="red" variant="light">
                  {error}
                </Alert>
              )}

              <Button
                type="submit"
                fullWidth
                size="md"
                loading={loading}
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
              </Button>
            </Stack>
          </form>
        </Paper>
      </Container>
    </Center>
  )
}

