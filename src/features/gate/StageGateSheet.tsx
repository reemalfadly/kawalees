// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { ArrowLeft, CircleAlert, CircleCheck, Circle } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { STAGE_META } from '@/lib/catalog';
import { cn } from '@/lib/cn';
import { getRequirements, type Requirement } from '@/lib/gates';
import { haptics } from '@/lib/haptics';
import { moveIdeaStage } from '@/lib/repo';
import { STAGES, type Idea, type Stage } from '@/lib/types';
import { toast } from '@/store/ui';
import { FIELD_LABELS } from './focusField';
import { useGate } from './gateStore';
import { announceMoved, refusalText } from './moves';
import { progressOf, requirementPhrase } from './stageStatus';

/* «نقطة تفتيش»: the only way forward between stages. It lists every requirement on the way as a
   live checklist, collects the person's confirmations (and the optional links), and moves the idea
   only when the repo accepts it. Success is shown only after the repo says ok. */

const APPROVAL_TEXT: Partial<Record<Stage, string>> = {
  shoot: 'أؤكد أني صوّرت هذه الفكرة فعلاً',
  edit: 'أؤكد أني أنجزت مونتاجها فعلاً',
  ready: 'أؤكد أني نشرتها فعلاً',
};

interface Shown {
  idea: Idea;
  to: Stage;
  key: number;
}

export function StageGateSheet() {
  const request = useGate((s) => s.request);
  const close = useGate((s) => s.close);
  // The query result carries the id it answered for, so a stale answer (from the previous
  // request, while the new one is still loading) is never mistaken for this idea.
  const wantedId = request?.ideaId;
  const answer = useLiveQuery(
    async () => (wantedId ? { id: wantedId, idea: (await db.ideas.get(wantedId)) ?? null } : null),
    [wantedId],
  );
  const current = answer && answer.id === wantedId ? answer : undefined;
  const idea = current?.idea;
  const live: Shown | null = request && idea ? { idea, to: request.to, key: request.key } : null;

  // Keep the last content on screen while the sheet animates out.
  const [last, setLast] = useState<Shown | null>(null);
  if (live && (last?.idea !== live.idea || last.to !== live.to || last.key !== live.key))
    setLast(live);
  const shown = live ?? last;

  // The idea vanished (deleted elsewhere) while the checkpoint was open: close quietly.
  const gone = Boolean(request) && current !== undefined && current.idea === null;
  useEffect(() => {
    if (gone) close();
  }, [gone, close]);

  return (
    <Sheet
      open={Boolean(live)}
      onClose={close}
      size="lg"
      title={shown ? `الانتقال إلى «${STAGE_META[shown.to].label}»` : 'نقطة التفتيش'}
      description={
        shown
          ? `من «${STAGE_META[shown.idea.stage].label}»، وبعد الاعتماد تُسجَّل في الفكرة`
          : undefined
      }
    >
      {shown && <GateBody key={shown.key} idea={shown.idea} to={shown.to} />}
    </Sheet>
  );
}

function GateBody({ idea, to }: { idea: Idea; to: Stage }) {
  const close = useGate((s) => s.close);
  const requestFocus = useGate((s) => s.requestFocus);
  const navigate = useNavigate();
  const location = useLocation();
  const headingId = useId();
  const noteId = useId();

  const from = STAGES.indexOf(idea.stage);
  const crossed = STAGES.slice(from, STAGES.indexOf(to));

  const [checked, setChecked] = useState<Stage[]>([]);
  const [proof, setProof] = useState(idea.proof ?? '');
  const [url, setUrl] = useState(idea.publishedUrl ?? '');
  const [busy, setBusy] = useState(false);
  // `busy` only reaches the button after a render; a ref closes the door at once, so presses that
  // arrive in the same instant cannot each start a move (and each announce one).
  const sending = useRef(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const extras = useMemo(
    () => ({ approvals: checked, proof, publishedUrl: url }),
    [checked, proof, url],
  );
  const reqs = getRequirements(idea, to, extras);
  const { met, total } = progressOf(reqs);
  const allMet = reqs.every((r) => r.met);

  const groups = crossed
    .map((s) => ({
      stage: s,
      reqs: reqs.filter((r) => r.stage === s),
      optional: s === 'edit' ? ('proof' as const) : s === 'ready' ? ('url' as const) : null,
    }))
    .filter((g) => g.reqs.length > 0 || g.optional);
  const multi = groups.length > 1;
  const firstUnmetApproval = reqs.find((r) => r.kind === 'approval' && !r.met)?.id;

  const toggle = (s: Stage) =>
    setChecked((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const goToField = (field: string) => {
    close();
    if (location.pathname !== `/idea/${idea.id}`) navigate(`/idea/${idea.id}`);
    requestFocus(idea.id, field);
  };

  const confirm = async () => {
    if (!allMet || busy || sending.current) return;
    sending.current = true;
    setBusy(true);
    setRefusal(null);
    try {
      const result = await moveIdeaStage(idea.id, to, {
        approvals: checked,
        // Optional links travel only when typed (or when clearing one that was there).
        ...(proof.trim() || idea.proof ? { proof } : {}),
        ...(url.trim() || idea.publishedUrl ? { publishedUrl: url } : {}),
      });
      if (!result.ok) {
        haptics.warn();
        if (result.error === 'not-found') {
          close();
          toast({ title: 'لا يمكن النقل', description: refusalText(result), tone: 'error' });
        } else setRefusal(refusalText(result));
        return;
      }
      close();
      announceMoved(idea, to, idea.stage);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <div data-testid="gate-sheet" className="flex flex-col gap-5">
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p id={headingId} className="text-sm font-medium text-ink-2">
            شروط الانتقال
          </p>
          <p className="num text-sm font-semibold text-ink" dir="ltr" data-testid="gate-progress">
            {met}/{total}
          </p>
        </div>
        <div
          role="progressbar"
          aria-labelledby={headingId}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={met}
          aria-valuetext={`${met} من ${total} شروط مستوفاة`}
          className="h-1.5 overflow-hidden rounded-full bg-surface-3"
        >
          <div
            className="h-full rounded-full bg-accent-gradient transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: total ? `${(met / total) * 100}%` : '100%' }}
          />
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.stage} aria-label={`قبل مغادرة «${STAGE_META[g.stage].label}»`}>
          {multi && (
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <span
                className="size-2 rounded-full"
                style={{ background: STAGE_META[g.stage].color }}
                aria-hidden
              />
              قبل مغادرة «{STAGE_META[g.stage].label}»
            </h3>
          )}
          <ul className="flex flex-col gap-1.5">
            {g.reqs.map((r) => (
              <RequirementRow
                key={r.id}
                idea={idea}
                req={r}
                checked={checked.includes(r.stage)}
                autofocus={r.id === firstUnmetApproval}
                onToggle={() => toggle(r.stage)}
                onGo={goToField}
              />
            ))}
          </ul>
          {g.optional === 'proof' && (
            <OptionalLink
              id="gate-proof"
              label="رابط الفيديو النهائي أو اسم الملف"
              value={proof}
              onChange={setProof}
              placeholder="https://… / reel-final.mp4"
              invalid={reqs.some((r) => r.id === 'proof')}
              ltr
            />
          )}
          {g.optional === 'url' && (
            <OptionalLink
              id="gate-url"
              label="رابط المنشور"
              value={url}
              onChange={setUrl}
              placeholder="https://instagram.com/reel/…"
              invalid={reqs.some((r) => r.id === 'published-url')}
              ltr
              url
            />
          )}
        </section>
      ))}

      {refusal && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-bad/12 px-3.5 py-3 text-sm text-bad"
        >
          <CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden />
          <span>{refusal}</span>
        </p>
      )}

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <Button
          variant="primary"
          size="lg"
          block
          data-testid="gate-confirm"
          data-autofocus={firstUnmetApproval ? undefined : ''}
          disabled={!allMet || busy}
          aria-describedby={allMet ? undefined : noteId}
          iconEnd={<ArrowLeft size={18} aria-hidden />}
          onClick={() => void confirm()}
        >
          اعتماد والانتقال
        </Button>
        {!allMet && (
          <p id={noteId} className="text-center text-xs text-ink-3">
            يُفعَّل الاعتماد عند استيفاء كل الشروط أعلاه
          </p>
        )}
      </div>
    </div>
  );
}

function RequirementRow({
  idea,
  req,
  checked,
  autofocus,
  onToggle,
  onGo,
}: {
  idea: Idea;
  req: Requirement;
  checked: boolean;
  autofocus: boolean;
  onToggle: () => void;
  onGo: (field: string) => void;
}) {
  const isApproval = req.kind === 'approval';
  const alreadyApproved = isApproval && idea.approvals?.[req.stage] != null;
  const Icon = req.met ? CircleCheck : isApproval ? Circle : CircleAlert;

  return (
    <li
      data-testid={`gate-req-${req.id}`}
      data-met={req.met ? 'true' : 'false'}
      className={cn(
        'flex items-start gap-3 rounded-2xl border px-3.5 py-2.5',
        req.met ? 'border-line bg-surface' : 'border-line-2 bg-surface-2',
      )}
    >
      <Icon
        size={20}
        className={cn('mt-0.5 shrink-0', req.met ? 'text-good' : 'text-ink-3')}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        {isApproval && !alreadyApproved ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={checked}
              onChange={onToggle}
              data-autofocus={autofocus ? '' : undefined}
              data-testid={`gate-check-${req.id}`}
              className="size-6 shrink-0 cursor-pointer accent-[var(--accent)]"
            />
            <span className="text-[15px] font-medium text-ink">
              {APPROVAL_TEXT[req.stage] ?? req.label}
            </span>
          </label>
        ) : (
          <>
            <p className={cn('text-[15px]', req.met ? 'text-ink-2' : 'font-medium text-ink')}>
              {req.met && alreadyApproved ? `${req.label}، واعتُمد سابقاً` : req.label}
            </p>
            {!req.met && (
              <p className="mt-0.5 text-xs text-ink-3" data-testid={`gate-state-${req.id}`}>
                {requirementPhrase(idea, req)}
              </p>
            )}
          </>
        )}
      </div>
      {!req.met && req.kind === 'field' && req.field && (
        <Button
          variant="tonal"
          size="sm"
          className="shrink-0"
          data-testid={`gate-go-${req.id}`}
          aria-label={`انتقال إلى حقل ${FIELD_LABELS[req.field] ?? req.field}`}
          onClick={() => onGo(req.field!)}
        >
          انتقال للحقل
        </Button>
      )}
    </li>
  );
}

function OptionalLink({
  id,
  label,
  value,
  onChange,
  placeholder,
  invalid,
  ltr,
  url,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  invalid: boolean;
  ltr?: boolean;
  url?: boolean;
}) {
  return (
    <div className="mt-2 flex flex-col gap-1.5 px-1">
      <label
        htmlFor={id}
        className="flex items-baseline justify-between gap-2 text-sm font-medium text-ink-2"
      >
        <span>{label}</span>
        <span className="text-xs font-normal text-ink-3">اختياري</span>
      </label>
      <Input
        id={id}
        data-testid={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={ltr ? 'ltr' : undefined}
        inputMode={url ? 'url' : undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        className={cn('h-11 text-base', invalid && 'border-bad')}
      />
    </div>
  );
}
