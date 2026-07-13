'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { TermsBlock, TermsDocument } from '@/lib/legal';
import { cn } from '@/lib/utils';
import { clearStoredWorkCustomerId } from '@/lib/work-org';

type TermsAcceptanceModalProps = {
  document: TermsDocument;
  onAccepted: () => void;
};

function TermsBody({ blocks }: { blocks: TermsBlock[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <h3 key={index} className="text-base font-semibold text-foreground pt-1">
              {block.text}
            </h3>
          );
        }
        if (block.type === 'list') {
          return (
            <ul key={index} className="list-disc pl-5 space-y-1 text-sm text-muted-foreground text-justify">
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }
        if (block.type === 'callout') {
          return (
            <div
              key={index}
              className="rounded-md border-l-4 border-primary bg-primary/5 px-3 py-2 text-sm text-foreground"
            >
              {block.text}
            </div>
          );
        }
        return (
          <p
            key={index}
            className={cn(
              'text-sm text-muted-foreground text-justify leading-relaxed',
              block.emphasis === 'strong' && 'font-semibold text-foreground',
              block.emphasis === 'italic' && 'italic',
            )}
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

export function TermsAcceptanceModal({ document, onAccepted }: TermsAcceptanceModalProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDecline = async () => {
    clearStoredWorkCustomerId();
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    await supabase.auth.signOut();
    router.push('/sign-in');
    router.refresh();
  };

  const handleAccept = async () => {
    if (!checked || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/accept-terms', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'No se pudo registrar la aceptación.');
        return;
      }
      onAccepted();
      router.refresh();
    } catch {
      setError('No se pudo registrar la aceptación.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
        className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl border border-default-200 bg-card shadow-xl"
      >
        <div className="border-b border-default-200 px-6 py-4">
          <h2 id="terms-title" className="text-xl font-semibold text-foreground">
            {document.title}
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {document.intro.map((line) => (
            <p key={line} className="text-sm text-muted-foreground text-justify leading-relaxed">
              {line}
            </p>
          ))}
          <div className="rounded-lg border border-default-200 bg-default-50 p-4 dark:bg-default-100/5">
            <TermsBody blocks={document.body} />
          </div>
        </div>

        <div className="space-y-4 border-t border-default-200 px-6 py-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="terms-accept"
              checked={checked}
              onCheckedChange={(value) => setChecked(value === true)}
              disabled={submitting}
            />
            <Label htmlFor="terms-accept" className="text-sm font-medium leading-snug cursor-pointer">
              {document.checkboxLabel}
            </Label>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button
              className="flex-1"
              disabled={!checked || submitting}
              onClick={() => void handleAccept()}
            >
              {submitting ? 'Guardando...' : document.acceptButtonLabel}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={submitting}
              onClick={() => void handleDecline()}
            >
              No acepto
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
