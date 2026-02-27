const REMEMBERED_EMAIL_KEY = 'vouchek.rememberedEmail';
const REMEMBER_EMAIL_KEY = 'vouchek.rememberEmail';

export async function loadRememberedEmail(): Promise<{ email: string; remember: boolean }> {
  if (typeof window === 'undefined') {
    return { email: '', remember: false };
  }

  try {
    const email = window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '';
    const remember = window.localStorage.getItem(REMEMBER_EMAIL_KEY) === 'true';
    return { email, remember };
  } catch {
    return { email: '', remember: false };
  }
}

export function persistRememberedEmail(email: string, remember: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (remember) {
      window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
      window.localStorage.setItem(REMEMBER_EMAIL_KEY, 'true');
      return;
    }

    window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
  } catch {
    // Ignore storage errors (private mode, quota, etc.).
  }
}
