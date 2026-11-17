// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { countWords } from './script';
import { STAGES, type Idea, type Stage } from './types';

/* Real gates between the production stages. Pure rules only: nothing here reads or writes
   the database, so every number the app shows can be trusted and every rule is unit-tested.

   Moving forward means leaving a stage, and leaving a stage needs its gate to pass:
     idea    → script : title, a platform, a format
     script  → shoot  : a hook, a script, no «___» blanks left
     shoot   → edit   : explicit approval that the shoot happened
     edit    → ready  : explicit approval (a link to the final video is optional)
     ready   → published : explicit approval (the post link is optional, checked only if given)
   Moving backward is always free. A jump over several stages needs every gate on the way.
   Scheduling needs the script gate. Data saved before gates existed is never judged
   retroactively: only forward moves and new schedules are checked. */

export const MIN_TITLE_CHARS = 3;
export const MIN_HOOK_WORDS = 3;
export const MIN_BODY_WORDS = 25;
export const MIN_PROOF_CHARS = 3;
/** The backup format caps both links at this length, so a longer one would make the whole
    backup unreadable on import. Refusing it here keeps every saved idea exportable. */
export const MAX_LINK_CHARS = 2000;

/** The stages whose leaving needs an explicit confirmation from the person. */
export const APPROVAL_STAGES: readonly Stage[] = ['shoot', 'edit', 'ready'];

export type RequirementKind = 'field' | 'approval' | 'proof' | 'url';

export interface Requirement {
  /** Stable key, e.g. `hook`, `blank-body`, `approve-shoot`, `proof`, `published-url`. */
  id: string;
  /** Plain, gender-neutral Arabic, ready to show as a checklist line. */
  label: string;
  met: boolean;
  kind: RequirementKind;
  /** The idea field that fixes it (`title`, `hook`, `proof`, `approvals`…). */
  field?: string;
  /** The stage this requirement is for leaving. */
  stage: Stage;
}

export interface GateResult {
  ok: boolean;
  missing: Requirement[];
}

/** What the person supplies at the moment of moving: approvals are the stages being confirmed now. */
export interface MoveExtras {
  approvals?: readonly Stage[];
  proof?: string;
  publishedUrl?: string;
}

// ── Small predicates ───────────────────────────────────────────

const BLANK = /_{3,}/u;

export function hasBlank(text: string): boolean {
  return BLANK.test(text);
}

export function isValidProof(value: string | undefined | null): boolean {
  const v = (value ?? '').trim();
  return v.length >= MIN_PROOF_CHARS && v.length <= MAX_LINK_CHARS;
}

/** http(s) link whose host has at least one dot, e.g. https://instagram.com/reel/abc */
export function isValidPublishedUrl(value: string | undefined | null): boolean {
  const v = (value ?? '').trim();
  return (
    v.length <= MAX_LINK_CHARS &&
    /^https?:\/\/[^\s/?#.:]+(?:\.[^\s/?#.:]+)+(?::\d+)?(?:[/?#]\S*)?$/iu.test(v)
  );
}

/** Why a typed proof is refused, in plain Arabic; null when it is fine (or empty: it is optional). */
export function proofProblem(value: string | undefined | null): string | null {
  const v = (value ?? '').trim();
  if (!v || isValidProof(v)) return null;
  return v.length > MAX_LINK_CHARS
    ? `رابط الفيديو أو اسم الملف أطول من ${MAX_LINK_CHARS} حرف`
    : `رابط الفيديو أو اسم الملف قصير جداً (${MIN_PROOF_CHARS} أحرف على الأقل)`;
}

/** Why a typed post link is refused, in plain Arabic; null when it is fine (or empty: it is optional). */
export function urlProblem(value: string | undefined | null): string | null {
  const v = (value ?? '').trim();
  if (!v || isValidPublishedUrl(v)) return null;
  return v.length > MAX_LINK_CHARS
    ? `رابط المنشور أطول من ${MAX_LINK_CHARS} حرف`
    : 'رابط المنشور غير صالح، ويبدأ بـ http:// أو https://';
}

/** A real calendar day written YYYY-MM-DD («2026-02-30» and «2026-13-01» are not). Year 0000 is not either;
    other years pass, because a date field being typed into passes through short years on the way. */
export function isRealDayKey(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1 || mo < 1 || mo > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= lengths[mo - 1]!;
}

/** A real time of day written HH:mm (00:00 to 23:59). */
export function isRealTimeKey(value: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  return Boolean(m) && Number(m![1]) <= 23 && Number(m![2]) <= 59;
}

export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}

export function isForwardMove(from: Stage, to: Stage): boolean {
  return stageIndex(to) > stageIndex(from);
}

/** Saved before gates existed: no `approvals` record at all. Never judged retroactively. */
export function isLegacyIdea(idea: Pick<Idea, 'approvals'>): boolean {
  return idea.approvals === undefined;
}

type Gated = Pick<
  Idea,
  | 'title'
  | 'platforms'
  | 'format'
  | 'hook'
  | 'body'
  | 'cta'
  | 'approvals'
  | 'proof'
  | 'publishedUrl'
>;

function approved(idea: Pick<Idea, 'approvals'>, stage: Stage): boolean {
  return idea.approvals?.[stage] != null;
}

// ── Requirements per gate ──────────────────────────────────────

function scriptRequirements(idea: Gated): Requirement[] {
  return [
    {
      id: 'hook',
      label: `خطّاف من ${MIN_HOOK_WORDS} كلمات على الأقل`,
      met: countWords(idea.hook) >= MIN_HOOK_WORDS,
      kind: 'field',
      field: 'hook',
      stage: 'script',
    },
    {
      id: 'body',
      label: `محتوى (سكريبت) من ${MIN_BODY_WORDS} كلمة على الأقل`,
      met: countWords(idea.body) >= MIN_BODY_WORDS,
      kind: 'field',
      field: 'body',
      stage: 'script',
    },
    {
      id: 'blank-hook',
      label: 'خلوّ الخطّاف من علامات الفراغ «___»',
      met: !hasBlank(idea.hook),
      kind: 'field',
      field: 'hook',
      stage: 'script',
    },
    {
      id: 'blank-body',
      label: 'خلوّ المحتوى من علامات الفراغ «___»',
      met: !hasBlank(idea.body),
      kind: 'field',
      field: 'body',
      stage: 'script',
    },
    {
      id: 'blank-cta',
      label: 'خلوّ الدعوة للتفاعل من علامات الفراغ «___»',
      met: !hasBlank(idea.cta),
      kind: 'field',
      field: 'cta',
      stage: 'script',
    },
  ];
}

/** Everything needed to LEAVE `from`. */
export function gateRequirements(idea: Gated, from: Stage): Requirement[] {
  switch (from) {
    case 'idea':
      return [
        {
          id: 'title',
          label: `عنوان من ${MIN_TITLE_CHARS} أحرف على الأقل`,
          met: idea.title.trim().length >= MIN_TITLE_CHARS,
          kind: 'field',
          field: 'title',
          stage: 'idea',
        },
        {
          id: 'platform',
          label: 'منصة واحدة على الأقل',
          met: idea.platforms.length >= 1,
          kind: 'field',
          field: 'platforms',
          stage: 'idea',
        },
        {
          id: 'format',
          label: 'تحديد نوع المحتوى',
          met: Boolean(idea.format),
          kind: 'field',
          field: 'format',
          stage: 'idea',
        },
      ];
    case 'script':
      return scriptRequirements(idea);
    case 'shoot':
      return [
        {
          id: 'approve-shoot',
          label: 'تأكيد أن التصوير تمّ فعلاً',
          met: approved(idea, 'shoot'),
          kind: 'approval',
          field: 'approvals',
          stage: 'shoot',
        },
      ];
    case 'edit':
      return [
        {
          id: 'approve-edit',
          label: 'تأكيد أن المونتاج تمّ فعلاً',
          met: approved(idea, 'edit'),
          kind: 'approval',
          field: 'approvals',
          stage: 'edit',
        },
        // Optional: the app is not an editor, so a link to the final video is only checked when given.
        ...(proofProblem(idea.proof)
          ? [
              {
                id: 'proof',
                label: proofProblem(idea.proof)!,
                met: false,
                kind: 'proof' as const,
                field: 'proof',
                stage: 'edit' as const,
              },
            ]
          : []),
      ];
    case 'ready':
      return [
        {
          id: 'approve-ready',
          label: 'تأكيد أن النشر تمّ فعلاً',
          met: approved(idea, 'ready'),
          kind: 'approval',
          field: 'approvals',
          stage: 'ready',
        },
        // Optional: the post link is only checked when given.
        ...(urlProblem(idea.publishedUrl)
          ? [
              {
                id: 'published-url',
                label: urlProblem(idea.publishedUrl)!,
                met: false,
                kind: 'url' as const,
                field: 'publishedUrl',
                stage: 'ready' as const,
              },
            ]
          : []),
      ];
    case 'published':
      return [];
  }
}

// ── Applying what the person supplied ──────────────────────────

/** The idea as it would be once `extras` are accepted. Only stages being crossed can be approved. */
export function applyExtras(
  idea: Idea,
  toStage: Stage,
  extras: MoveExtras | undefined,
  now: number,
): Idea {
  if (!extras) return idea;
  const from = stageIndex(idea.stage);
  const to = stageIndex(toStage);
  const crossed = (s: Stage) => stageIndex(s) >= from && stageIndex(s) < to;
  const approvals = { ...idea.approvals };
  // Only the three stages that ask for a confirmation can be confirmed; anything else is dropped.
  for (const s of extras.approvals ?? [])
    if (APPROVAL_STAGES.includes(s) && crossed(s) && approvals[s] == null) approvals[s] = now;
  const next: Idea = { ...idea, approvals };
  if (extras.proof !== undefined && crossed('edit')) next.proof = extras.proof.trim();
  if (extras.publishedUrl !== undefined && crossed('ready'))
    next.publishedUrl = extras.publishedUrl.trim();
  return next;
}

/**
 * Everything standing between the idea and `toStage`, in order, each flagged met or not.
 * Empty for a backward move or staying put. `extras` shows how it would look once supplied.
 */
export function getRequirements(
  idea: Idea,
  toStage: Stage,
  extras?: MoveExtras,
  now = Date.now(),
): Requirement[] {
  const from = stageIndex(idea.stage);
  const to = stageIndex(toStage);
  if (to <= from) return [];
  const view = applyExtras(idea, toStage, extras, now);
  return STAGES.slice(from, to).flatMap((s) => gateRequirements(view, s));
}

export function checkMove(
  idea: Idea,
  toStage: Stage,
  extras?: MoveExtras,
  now = Date.now(),
): GateResult {
  const missing = getRequirements(idea, toStage, extras, now).filter((r) => !r.met);
  return { ok: missing.length === 0, missing };
}

/** Putting a day on an idea needs the script gate: a real hook and script, no blanks. */
export function checkSchedule(idea: Gated): GateResult {
  const missing = scriptRequirements(idea).filter((r) => !r.met);
  return { ok: missing.length === 0, missing };
}

/** The furthest stage up to `wanted` that the idea may sit in without any approvals. */
export function reachableStage(idea: Idea, wanted: Stage): Stage {
  let reached: Stage = 'idea';
  for (const s of STAGES.slice(1, stageIndex(wanted) + 1)) {
    if (!checkMove({ ...idea, stage: 'idea' }, s).ok) break;
    reached = s;
  }
  return reached;
}

// ── Trust in the numbers ───────────────────────────────────────

/** Whether a published idea may feed XP, achievements and streaks: legacy data always, new data only with its approval (the post link is optional). */
export function publishGatePassed(idea: Idea): boolean {
  if (isLegacyIdea(idea)) return true;
  return approved(idea, 'ready');
}

/** `published` only when it really passed the gate; otherwise the last honest stage. */
export function effectiveStage(idea: Idea): Stage {
  return idea.stage === 'published' && !publishGatePassed(idea) ? 'ready' : idea.stage;
}

/** One line for a toast: the missing labels joined. */
export function missingSummary(missing: readonly Requirement[]): string {
  return missing.map((m) => m.label).join(' · ');
}
