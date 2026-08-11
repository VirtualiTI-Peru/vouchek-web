import { TERMS_ADMINISTRADOR } from './terms-administrador';
import { TERMS_VERIFICADOR } from './terms-verificador';
import { termsVersionKey, type TermsBlock, type TermsDocument } from './types';
import { VOUCHEK_ROLES, isVouchekRole } from '@/lib/roles';

export type WebTermsRole = string;

export function resolveWebTermsDocument(
  role: WebTermsRole | undefined,
  isSuperAdmin: boolean,
): TermsDocument | null {
  if (isSuperAdmin) return null;

  if (isVouchekRole(role, VOUCHEK_ROLES.VERIFICADOR)) return TERMS_VERIFICADOR;
  if (isVouchekRole(role, VOUCHEK_ROLES.ADMIN, VOUCHEK_ROLES.SISTEMA)) return TERMS_ADMINISTRADOR;

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
