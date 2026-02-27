/** Indica si el mensaje de Supabase corresponde a un usuario/correo ya registrado. */
export function isSupabaseDuplicateUserMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('already been registered') ||
    normalized.includes('already registered') ||
    normalized.includes('user already registered') ||
    normalized.includes('email address is already registered')
  );
}

/** Traduce mensajes comunes de Supabase Auth y PostgREST al español (es-PE). */
export function mapSupabaseAuthError(message: string): string {
  if (!message?.trim()) return message;

  const normalized = message.toLowerCase();

  if (isSupabaseDuplicateUserMessage(message)) {
    return 'El usuario ya existe.';
  }
  if (normalized.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Debes confirmar tu correo antes de ingresar.';
  }
  if (normalized.includes('password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (normalized.includes('same as the old password')) {
    return 'La nueva contraseña debe ser diferente a la anterior.';
  }
  if (
    normalized.includes('token has expired') ||
    normalized.includes('otp_expired') ||
    normalized.includes('invalid or expired')
  ) {
    return 'El enlace expiró. Solicita uno nuevo.';
  }
  if (normalized.includes('invalid refresh token')) {
    return 'La sesión expiró. Vuelve a iniciar sesión.';
  }
  if (normalized.includes('user not found')) {
    return 'Usuario no encontrado.';
  }
  if (normalized.includes('email rate limit exceeded') || normalized.includes('too many requests')) {
    return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
  }
  if (normalized.includes('signup is disabled')) {
    return 'El registro no está habilitado.';
  }
  if (normalized.includes('duplicate key value violates unique constraint')) {
    return 'El registro ya existe.';
  }
  if (normalized.includes('jwt expired')) {
    return 'La sesión expiró. Vuelve a iniciar sesión.';
  }

  return message;
}

/** Alias para errores de Supabase en general (auth, admin API, PostgREST). */
export const mapSupabaseError = mapSupabaseAuthError;
