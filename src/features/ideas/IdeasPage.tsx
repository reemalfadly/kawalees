// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { Archive, Columns3, LayoutGrid, Lightbulb, Plus, Search, SearchX, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Page, PageHeader } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { PlatformIcon } from '@/components/ui/PlatformIcon';
import { Segmented } from '@/components/ui/Segmented';
import { useIdeas, usePillars, useSettings } from '@/hooks/data';
import { PLATFORM_META, STAGE_META } from '@/lib/catalog';
import { plural, WORDS } from '@/lib/format';
import { normalizeArabic } from '@/lib/text';
import { STAGES, type Idea, type PlatformId, type Stage } from '@/lib/types';
import { useUI } from '@/store/ui';
import { Board } from './Board';
import { IdeaCard } from './IdeaCard';

type View = 'grid' | 'board';
type Sort = 'recent' | 'spark' | 'date';

export default function IdeasPage() {
  const all = useIdeas();
  const pillars = usePillars();
  const settings = useSettings();
  const openCapture = useUI((s) => s.openCapture);
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'board' ? 'board' : 'grid';
  const focus = (params.get('focus') as Stage | null) ?? null;

  const [query, setQuery] = useState('');
  const [stage, setStage] = useState<Stage | 'all'>('all');
  const [platform, setPlatform] = useState<PlatformId | null>(null);
  const [pillar, setPillar] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('recent');
  const [archived, setArchived] = useState(false);

  const setView = (v: View) => {
    const next = new URLSearchParams(params);
    if (v === 'board') next.set('view', 'board');
    else next.delete('view');
    next.delete('focus');
    setParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    const q = normalizeArabic(query);
    let list = all.filter((i: Idea) => i.archived === archived);
    if (q)
      list = list.filter((i) =>
        normalizeArabic(`${i.title} ${i.hook} ${i.body} ${i.notes}`).includes(q),
      );
    if (platform) list = list.filter((i) => i.platforms.includes(platform));
    if (pillar) list = list.filter((i) => i.pillarId === pillar);
    if (view === 'grid' && stage !== 'all') list = list.filter((i) => i.stage === stage);
    const sorted = [...list];
    if (sort === 'recent') sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    if (sort === 'spark') sorted.sort((a, b) => b.spark - a.spark || b.updatedAt - a.updatedAt);
    if (sort === 'date')
      sorted.sort(
        (a, b) =>
          (a.scheduledFor ?? '9999').localeCompare(b.scheduledFor ?? '9999') ||
          b.updatedAt - a.updatedAt,
      );
    return sorted;
  }, [all, query, platform, pillar, stage, sort, view, archived]);

  const liveCount = all.filter((i) => !i.archived).length;
  const archivedCount = all.length - liveCount;
  const hasFilters = Boolean(query || platform || pillar || stage !== 'all');

  const clearFilters = () => {
    setQuery('');
    setPlatform(null);
    setPillar(null);
    setStage('all');
  };

  return (
    <Page wide={view === 'board'}>
      <PageHeader
        title="الأفكار"
        subtitle={liveCount > 0 ? `${plural(liveCount, WORDS.idea)} في البنك` : 'بنك الأفكار'}
        actions={
          <>
            <Segmented
              label="طريقة العرض"
              value={view}
              onChange={setView}
              options={[
                {
                  value: 'grid',
                  label: <span className="hidden sm:inline">بطاقات</span>,
                  icon: <LayoutGrid size={16} />,
                },
                {
                  value: 'board',
                  label: <span className="hidden sm:inline">المراحل</span>,
                  icon: <Columns3 size={16} />,
                },
              ]}
            />
            <Button
              variant="primary"
              className="hidden md:inline-flex"
              icon={<Plus size={18} />}
              onClick={() => openCapture()}
            >
              فكرة
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="glass flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-3.5 transition-[border-color,box-shadow] focus-within:border-accent focus-within:shadow-[0_0_0_4px_var(--accent-softer)] sm:max-w-sm">
            <Search size={17} className="shrink-0 text-ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث في الأفكار والسكريبتات"
              aria-label="بحث في الأفكار"
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
            />
            {query && (
              <button
                type="button"
                aria-label="مسح البحث"
                onClick={() => setQuery('')}
                className="text-ink-3 hover:text-ink"
              >
                <X size={16} />
              </button>
            )}
          </label>
          {view === 'grid' && (
            <Segmented
              size="sm"
              label="الترتيب"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'recent', label: 'الأحدث' },
                { value: 'spark', label: 'الأقوى' },
                { value: 'date', label: 'الموعد' },
              ]}
            />
          )}
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:px-0">
          {view === 'grid' && (
            <>
              <Chip selected={stage === 'all'} onClick={() => setStage('all')}>
                الكل
              </Chip>
              {STAGES.map((s) => (
                <Chip
                  key={s}
                  selected={stage === s}
                  onClick={() => setStage(stage === s ? 'all' : s)}
                  icon={
                    <span
                      className="size-2 rounded-full"
                      style={{ background: STAGE_META[s].color }}
                    />
                  }
                >
                  {STAGE_META[s].label}
                </Chip>
              ))}
              <span className="mx-1 w-px shrink-0 self-stretch bg-line" aria-hidden />
            </>
          )}
          {settings.platforms.map((p) => (
            <Chip
              key={p}
              selected={platform === p}
              onClick={() => setPlatform(platform === p ? null : p)}
              icon={<PlatformIcon id={p} size={15} />}
            >
              {PLATFORM_META[p].label}
            </Chip>
          ))}
          {pillars.length > 0 && (
            <span className="mx-1 w-px shrink-0 self-stretch bg-line" aria-hidden />
          )}
          {pillars.map((p) => (
            <Chip
              key={p.id}
              selected={pillar === p.id}
              onClick={() => setPillar(pillar === p.id ? null : p.id)}
            >
              <span aria-hidden>{p.emoji}</span>
              {p.name}
            </Chip>
          ))}
          {archivedCount > 0 && (
            <>
              <span className="mx-1 w-px shrink-0 self-stretch bg-line" aria-hidden />
              <Chip
                selected={archived}
                onClick={() => setArchived((a) => !a)}
                icon={<Archive size={15} />}
              >
                الأرشيف · {archivedCount}
              </Chip>
            </>
          )}
        </div>
      </div>

      {liveCount === 0 && !archived ? (
        <EmptyState
          icon={Lightbulb}
          title="بنك الأفكار فاضي"
          description="كل محتوى عظيم بدأ بفكرة صغيرة. أول فكرة تبدأ من زر «فكرة جديدة»، أو من «شرارة اليوم» في الرئيسية."
          action={
            <Button variant="primary" icon={<Plus size={18} />} onClick={() => openCapture()}>
              فكرة جديدة
            </Button>
          }
        />
      ) : view === 'board' ? (
        <Board ideas={filtered} focus={focus} />
      ) : filtered.length === 0 ? (
        <EmptyState
          compact
          icon={SearchX}
          title="ما في نتائج"
          description="ما في فكرة تطابق هالفلاتر"
          action={
            hasFilters && (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                مسح الفلاتر
              </Button>
            )
          }
        />
      ) : (
        <motion.ul layout className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {filtered.map((idea) => (
              <motion.li
                key={idea.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              >
                <IdeaCard idea={idea} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </Page>
  );
}
