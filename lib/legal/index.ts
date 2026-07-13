import { TERMS_ADMINISTRADOR } from './terms-administrador';
import { TERMS_VERIFICADOR } from './terms-verificador';
import { termsVersionKey, type TermsBlock, type TermsDocument } from './types';

export type WebTermsRole = 'org:verificador' | 'org:admin' | 'org:sistema' | string;

export function resolveWebTermsDocument(
  role: WebTermsRole | undefined,
  isSuperAdmin: boolean,
): TermsDocument | null {
  if (isSuperAdmin) return null;

  if (role === 'org:verificador') return TERMS_VERIFICADOR;
  if (role === 'org:admin' || role === 'org:sistema') return TERMS_ADMINISTRADOR;

  return null;
}

export function hasAcceptedCurrentTerms(
  acceptedVersion: string | null | undefined,
  doc: TermsDocument | null,
): boolean {
  if (!doc) return true;
  return acceptedVersion === termsVersionKey(doc);
}

export { termsVersionKey };
export type { TermsBlock, TermsDocument };
