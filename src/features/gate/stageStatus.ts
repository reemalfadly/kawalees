// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { STAGE_META } from '@/lib/catalog';
import {
  checkSchedule,
  getRequirements,
  isLegacyIdea,
  MIN_BODY_WORDS,
  MIN_HOOK_WORDS,
  MIN_TITLE_CHARS,
  publishGatePassed,
  type MoveExtras,
  type Requirement,
} from '@/lib/gates';
import { countWords } from '@/lib/script';
import type { Idea, Stage } from '@/lib/types';
import { STAGES } from '@/lib/types';

/* Honest wording for where an idea really stands, derived from the same rules the repo
   enforces (lib/gates). Pure: no database, no React. Every sentence is built from the idea's
   actual state, never from a canned «almost ready». */

type Fields = Pick<
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
  | 'scheduledFor'
  | 'stage'
>;

const BLANK_MARK = '«___»';

/** One short, specific phrase for an unmet requirement: «الخطّاف فارغ»، «المحتوى 8 من 25 كلمة». */
export function requirementPhrase(idea: Fields, r: Requirement): string {
  switch (r.id) {
    case 'title':
      return idea.title.trim() ? `العنوان أقصر من ${MIN_TITLE_CHARS} أحرف` : 'العنوان فارغ';
    case 'platform':
      return 'لم تُحدَّد منصة';
    case 'format':
      return 'نوع المحتوى غير محدّد';
    case 'hook': {
      const n = countWords(idea.hook);
      return n === 0 ? 'الخطّاف فارغ' : `الخطّاف ${n} من ${MIN_HOOK_WORDS} كلمات`;
    }
    case 'body': {
      const n = countWords(idea.body);
      return n === 0 ? 'المحتوى فارغ' : `المحتوى ${n} من ${MIN_BODY_WORDS} كلمة`;
    }
    case 'blank-hook':
      return `في الخطّاف علامة ${BLANK_MARK} لم تُستبدل`;
    case 'blank-body':
      return `في المحتوى علامة ${BLANK_MARK} لم تُستبدل`;
    case 'blank-cta':
      return `في الدعوة للتفاعل علامة ${BLANK_MARK} لم تُستبدل`;
    case 'approve-shoot':
      return 'بانتظار اعتمادك للتصوير';
    case 'approve-edit':
      return 'بانتظار اعتمادك للمونتاج';
    case 'approve-ready':
      return 'بانتظار اعتمادك للنشر';
    // Both are optional: they only appear as unmet when a value was typed and is not valid.
    case 'proof':
      return r.label.includes('أطول') ? r.label : 'رابط الفيديو أو اسم الملف قصير جداً';
    case 'published-url':
      return r.label.includes('أطول') ? r.label : 'رابط المنشور غير صالح';
    default:
      return r.label;
  }
}

/** Phrases for a list of unmet requirements, joined for one line («أ · ب · وغيرها 2»). */
export function joinPhrases(idea: Fields, unmet: readonly Requirement[], max = 2): string {
  const phrases = unmet.map((r) => requirementPhrase(idea, r));
  if (phrases.length <= max) return phrases.join(' · ');
  return `${phrases.slice(0, max).join(' · ')} · وغيرها ${phrases.length - max}`;
}

export function progressOf(reqs: readonly Requirement[]): { met: number; total: number } {
  return { met: reqs.filter((r) => r.met).length, total: reqs.length };
}

export interface StageStatus {
  /** The stage the idea would move to next, null when it is already published. */
  next: Stage | null;
  met: number;
  total: number;
  unmet: Requirement[];
  /** True when every requirement for the next stage is already satisfied. */
  ready: boolean;
  /** The honest line shown under the stepper. */
  headline: string;
}

export function stageStatus(idea: Idea, now = Date.now()): StageStatus {
  const idx = STAGES.indexOf(idea.stage);
  const next = idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1]! : null;
  if (!next) {
    return {
      next: null,
      met: 0,
      total: 0,
      unmet: [],
      ready: false,
      headline: publishGatePassed(idea) ? 'نزل للعالم' : 'نزل للعالم، لكن اعتماد النشر غير مسجّل',
    };
  }
  const reqs = getRequirements(idea, next, undefined, now);
  const unmet = reqs.filter((r) => !r.met);
  const { met, total } = progressOf(reqs);
  const ready = unmet.length === 0;
  const target = STAGE_META[next].label;
  return {
    next,
    met,
    total,
    unmet,
    ready,
    headline: ready
      ? `استوفت الفكرة شروط الانتقال إلى «${target}»`
      : `قبل «${target}»: ${joinPhrases(idea, unmet)}`,
  };
}

/** What the person has supplied so far, as the extras the repo takes. */
export function extrasFrom(input: {
  approvals: readonly Stage[];
  proof: string;
  publishedUrl: string;
}): MoveExtras {
  return {
    approvals: [...input.approvals],
    proof: input.proof,
    publishedUrl: input.publishedUrl,
  };
}

// ── Scheduling ─────────────────────────────────────────────────

/** Why a day cannot be put on this idea yet; empty when it can. */
export function scheduleBlockers(idea: Fields): Requirement[] {
  return checkSchedule(idea).missing;
}

/** A day is shown as a real plan only when the idea can stand behind it. Ideas saved before
    the gates existed are trusted as they were; newer ones must still have a hook and a script. */
export function isCredibleSchedule(idea: Fields & Pick<Idea, 'approvals'>): boolean {
  if (!idea.scheduledFor) return false;
  if (isLegacyIdea(idea)) return true;
  return checkSchedule(idea).ok;
}

// ── Creation ───────────────────────────────────────────────────

/** An honest sentence when a new idea could not be saved where the person asked (stage lowered
    or day dropped). Null when it landed exactly as requested. */
export function describeCreation(
  requested: { stage?: Stage; scheduledFor?: string | null },
  idea: Idea,
): { title: string; description: string } | null {
  const stageLowered =
    Boolean(requested.stage) && STAGES.indexOf(requested.stage!) > STAGES.indexOf(idea.stage);
  const scheduleDropped = Boolean(requested.scheduledFor) && !idea.scheduledFor;
  if (!stageLowered && !scheduleDropped) return null;

  const unmet = [
    ...(stageLowered ? getRequirements(idea, requested.stage!).filter((r) => !r.met) : []),
    ...(scheduleDropped ? checkSchedule(idea).missing : []),
  ];
  const seen = new Set<string>();
  const unique = unmet.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));

  const lead =
    stageLowered && scheduleDropped
      ? `لم تُنقل إلى «${STAGE_META[requested.stage!].label}» ولم يُحفظ الموعد`
      : stageLowered
        ? `لم تُنقل إلى «${STAGE_META[requested.stage!].label}» بعد`
        : 'لم يُحفظ الموعد بعد';
  return {
    title: `حُفظت في «${STAGE_META[idea.stage].label}»`,
    description: `${lead}. المطلوب أولاً: ${joinPhrases(idea, unique, 3)}`,
  };
}

// ── Approval record ────────────────────────────────────────────

export interface ApprovalEntry {
  stage: Stage;
  label: string;
  at: number;
  /** The proof or the post link that went with this approval. */
  link?: { kind: 'proof' | 'url'; value: string };
}

const APPROVAL_LABELS: Partial<Record<Stage, string>> = {
  shoot: 'اعتُمد التصوير',
  edit: 'اعتُمد المونتاج',
  ready: 'اعتُمد النشر',
};

/** The approvals recorded on the idea, in production order, each with its proof or link. */
export function approvalEntries(
  idea: Pick<Idea, 'approvals' | 'proof' | 'publishedUrl'>,
): ApprovalEntry[] {
  const out: ApprovalEntry[] = [];
  for (const stage of STAGES) {
    const at = idea.approvals?.[stage];
    const label = APPROVAL_LABELS[stage];
    if (at == null || !label) continue;
    const entry: ApprovalEntry = { stage, label, at };
    if (stage === 'edit' && idea.proof?.trim())
      entry.link = { kind: 'proof', value: idea.proof.trim() };
    if (stage === 'ready' && idea.publishedUrl?.trim())
      entry.link = { kind: 'url', value: idea.publishedUrl.trim() };
    out.push(entry);
  }
  return out;
}

/** «17 نوفمبر 9:30 م» (Western digits, the device's own month names). */
export function formatApprovalTime(at: number): string {
  const d = new Date(at);
  const day = new Intl.DateTimeFormat('ar-KW-u-nu-latn', { day: 'numeric', month: 'long' }).format(
    d,
  );
  const time = new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
  return `${day} ${time}`;
}

/** Whether a proof value is a web link (so it can be opened) rather than a file name. */
export function isWebLink(value: string): boolean {
  return /^https?:\/\//iu.test(value.trim());
}
