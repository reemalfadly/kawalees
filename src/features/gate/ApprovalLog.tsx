// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { Check, Copy, ExternalLink, Link2, Pencil, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import { updateProof } from '@/lib/repo';
import type { Idea } from '@/lib/types';
import { toast } from '@/store/ui';
import { approvalEntries, formatApprovalTime, isWebLink, type ApprovalEntry } from './stageStatus';

/* The record of what the person confirmed, under the stepper: «اعتُمد التصوير · 17 نوفمبر 9:30 م»,
   with the optional final-video link and post link. Links can be copied, opened, added or fixed
   (the repo validates them: an invalid value is refused with its reason). */

export function ApprovalLog({ idea }: { idea: Idea }) {
  const entries = approvalEntries(idea);
  if (entries.length === 0) return null;
  return (
    <Card className="mt-3 !p-3 sm:!p-4" data-testid="approval-log">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <ShieldCheck size={17} className="text-good" aria-hidden />
        سجل الاعتمادات
      </h2>
      <ul className="flex flex-col gap-2.5">
        {entries.map((e) => (
          <li
            key={e.stage}
            data-testid={`approval-${e.stage}`}
            className="rounded-2xl border border-line bg-surface px-3.5 py-2.5"
          >
            <p className="flex items-center gap-2 text-sm text-ink">
              <Check size={16} className="shrink-0 text-good" aria-hidden />
              <span>
                {e.label} · <bdi>{formatApprovalTime(e.at)}</bdi>
              </span>
            </p>
            {(e.stage === 'edit' || e.stage === 'ready') && <LinkLine idea={idea} entry={e} />}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function LinkLine({ idea, entry }: { idea: Idea; entry: ApprovalEntry }) {
  const isUrl = entry.stage === 'ready';
  const field = isUrl ? 'publishedUrl' : 'proof';
  const noun = isUrl ? 'رابط المنشور' : 'رابط الفيديو أو اسم الملف';
  const value = entry.link?.value ?? '';
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await updateProof(idea.id, { [field]: text });
      if (!result.ok) {
        setError(result.missing[0]?.label ?? 'تعذّر حفظ الرابط');
        return;
      }
      setEditing(false);
      toast({ title: text.trim() ? 'حُفظ الرابط' : 'أُزيل الرابط', tone: 'success' });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: 'نُسخ الرابط' });
    } catch {
      toast({ title: 'تعذّر النسخ', description: 'يمكن تحديد النص ونسخه يدوياً', tone: 'error' });
    }
  };

  if (editing)
    return (
      <form
        className="mt-2 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label htmlFor={`log-${field}`} className="text-xs font-medium text-ink-2">
          {noun} <span className="font-normal text-ink-3">اختياري</span>
        </label>
        <div className="flex gap-2">
          <Input
            id={`log-${field}`}
            data-testid={`log-${field}-input`}
            value={text}
            dir="ltr"
            inputMode={isUrl ? 'url' : undefined}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            onChange={(e) => setText(e.target.value)}
            className={cn('h-11 flex-1 text-base', error && 'border-bad')}
          />
          <Button type="submit" variant="primary" size="sm" disabled={busy}>
            حفظ
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(false);
              setText(value);
              setError(null);
            }}
          >
            إلغاء
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-bad">
            {error}
          </p>
        )}
      </form>
    );

  if (!value)
    return (
      <button
        type="button"
        data-testid={`log-${field}-add`}
        onClick={() => {
          setText('');
          setEditing(true);
        }}
        className="relative mt-1.5 inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-accent-ink hover:underline"
      >
        <Link2 size={14} aria-hidden />
        {isUrl ? 'إضافة رابط المنشور (اختياري)' : 'إضافة رابط الفيديو (اختياري)'}
      </button>
    );

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <Link2 size={14} className="shrink-0 text-ink-3" aria-hidden />
      <span
        dir="ltr"
        className="min-w-0 flex-1 truncate text-start text-xs text-ink-2"
        data-testid={`log-${field}-value`}
        title={value}
      >
        {value}
      </span>
      <IconButton label={`نسخ ${noun}`} size="sm" onClick={() => void copy()}>
        <Copy size={15} />
      </IconButton>
      {isWebLink(value) && (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`فتح ${noun}`}
          className="grid size-8 shrink-0 place-items-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink tap:size-11"
        >
          <ExternalLink size={15} aria-hidden />
        </a>
      )}
      <IconButton
        label={`تعديل ${noun}`}
        size="sm"
        onClick={() => {
          setText(value);
          setEditing(true);
        }}
      >
        <Pencil size={15} />
      </IconButton>
    </div>
  );
}
