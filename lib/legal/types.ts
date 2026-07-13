export type TermsBlock =
  | { type: 'paragraph'; text: string; emphasis?: 'normal' | 'strong' | 'italic' }
  | { type: 'heading'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'callout'; text: string };

export type TermsDocument = {
  /** Stable id used in profiles.terms_accepted_version prefix */
  id: 'transportista' | 'verificador' | 'administrador';
  /** Bump when legal text changes to force re-acceptance */
  version: string;
  title: string;
  intro: string[];
  body: TermsBlock[];
  checkboxLabel: string;
  acceptButtonLabel: string;
};

export function termsVersionKey(doc: Pick<TermsDocument, 'id' | 'version'>): string {
  return `${doc.id}:${doc.version}`;
}
