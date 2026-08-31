'use client';
/* eslint-disable react/react-compiler -- React Compiler is not enabled; browser-only drafts hydrate after SSR. Other hook and type checks remain enabled. */
/* eslint-disable next/no-html-link-for-pages -- The only internal anchor starts dispatcher-owned authentication via top-level navigation; it must not use Link/prefetch. */
/* eslint-disable next/no-img-element -- Official remote card images are lazy-loaded with fixed dimensions; no image proxy is required. */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Compass,
  Plus,
  Search,
  Trash2,
  Crown,
  Copy,
  Save,
  Printer,
  Download,
  Upload,
  Swords,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  WifiOff,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect as Select,
  NativeSelectOption as Option,
} from '@/components/ui/native-select';
import { Profile, Stats, Rule } from './profile';
import type {
  Catalog,
  Character,
  Entry,
  Lang,
  PublicMatch,
  Roster,
  SavedRoster,
} from '@/lib/model';
import {
  available,
  freshRoster,
  total,
  validate,
  STATES,
  spellsFor,
  SOURCES,
} from '@/lib/game';
import type { MatchAction } from '@/lib/game';
import {
  name,
  ruleName,
  ruleText,
  stateNames,
  translations,
  term,
  upgradeName,
  upgradeText,
  statNames,
  translationCurrent,
} from '@/lib/i18n';
import { errorText, issueText } from '@/lib/messages';
import {
  UPGRADES,
  upgradeOptions,
  upgradeCost,
  upgraded,
  UPGRADE_SOURCE,
} from '@/lib/upgrades';
import { parseRoster } from '@/lib/validation';

type Summary = {
  id: string;
  status: string;
  updatedAt: string;
  result: string;
  players: { name: string; rosterName: string }[];
  revision: number;
};
type Bootstrap = {
  userId: string;
  rosters: Omit<SavedRoster, 'catalog' | 'canEdit'>[];
  matches: Summary[];
};
type Meta = { id: string; revision: number; token: string; canEdit: boolean };
const initial: Bootstrap = { userId: '', rosters: [], matches: [] };
async function request<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const r = await fetch('/api/guild', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await r.json()) as { error?: string };
  if (!r.ok) throw Error(data.error ?? `HTTP ${r.status}`);
  return data as T;
}
function download(filename: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function useCaption(lang: Lang) {
  return (ru: string, en: string) => (lang === 'ru' ? ru : en);
}

export default function GuildApp({
  catalog: latest,
  initialUi = 'ru',
  initialLang = 'ru',
}: {
  catalog: Catalog;
  initialUi?: Lang;
  initialLang?: Lang;
}) {
  const [ui, setUi] = useState<Lang>(initialUi),
    [lang, setLang] = useState<Lang>(initialLang),
    [tab, setTab] = useState('builder'),
    [d, setData] = useState(latest),
    [r, setRoster] = useState<Roster>(() => ({
      ...freshRoster(latest),
      name: initialUi === 'en' ? 'New expedition' : 'Новая экспедиция',
    }));
  const [meta, setMeta] = useState<Meta | null>(null),
    [boot, setBoot] = useState(initial),
    [hydrated, setHydrated] = useState(false),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [q, setQ] = useState(''),
    [classId, setClass] = useState(''),
    [maxCost, setMaxCost] = useState(100),
    [tag, setTag] = useState(''),
    [neutral, setNeutral] = useState(true),
    [catalogFaction, setCatalogFaction] = useState('');
  const [profile, setProfile] = useState<{ c: Character; d: Catalog } | null>(
      null,
    ),
    [selected, setSelected] = useState<string | null>(null),
    [match, setMatch] = useState<PublicMatch | null>(null),
    [matchToken, setMatchToken] = useState(''),
    [canJoin, setCanJoin] = useState(false),
    [sync, setSync] = useState('online'),
    [links, setLinks] = useState<{ label: string; url: string }[]>([]),
    [joinRoster, setJoinRoster] = useState(''),
    [playerName, setPlayerName] = useState(''),
    [code, setCode] = useState('');
  const [history, setHistory] = useState<
    { revision: number; payload: string; updated: string }[]
  >([]);
  const importRef = useRef<HTMLInputElement>(null),
    matchRef = useRef<PublicMatch | null>(null),
    t = useCaption(ui);
  const upgrades = d.upgrades ?? UPGRADES;
  const mutate = (fn: (r: Roster) => Roster) => {
    setRoster(fn);
    setDirty(true);
  };
  const refresh = useCallback(async () => {
    const b = await request<Bootstrap>('bootstrap');
    setBoot(b);
    return b;
  }, []);
  const problem = useCallback((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    setError(msg);
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      problem(e);
    } finally {
      setBusy(false);
    }
  };
  const acceptMatch = useCallback((next: PublicMatch) => {
    if (
      !matchRef.current ||
      next.id !== matchRef.current.id ||
      next.revision >= matchRef.current.revision
    ) {
      matchRef.current = next;
      setMatch(next);
    }
  }, []);
  const openRoster = useCallback(async (id: string, key = '') => {
    const s = await request<SavedRoster>('roster.get', { id, token: key });
    setRoster(s.roster);
    setData(s.catalog);
    setMeta({ id: s.id, revision: s.revision, token: key, canEdit: s.canEdit });
    setDirty(false);
    setTab('builder');
    setSelected(null);
    setHistory([]);
  }, []);
  const openMatch = useCallback(
    async (id: string, key = '') => {
      const s = await request<{ match: PublicMatch; canJoin: boolean }>(
        'match.get',
        { id, token: key },
      );
      setMatchToken(key);
      acceptMatch(s.match);
      setCanJoin(s.canJoin);
      setTab('matches');
      setSync('online');
    },
    [acceptMatch],
  );
  useEffect(() => {
    try {
      const prefs = JSON.parse(
        localStorage.getItem('calad.preferences') ?? 'null',
      );
      if (prefs) {
        setUi(prefs.ui === 'en' ? 'en' : 'ru');
        setLang(prefs.lang === 'en' ? 'en' : 'ru');
        setPlayerName(prefs.playerName ?? '');
      }
      const draft = JSON.parse(localStorage.getItem('calad.draft') ?? 'null');
      if (draft) {
        setRoster(parseRoster(draft.roster));
        if (draft.catalog?.version === draft.roster.dataVersion)
          setData(draft.catalog);
        setMeta(draft.meta);
        setDirty(draft.dirty);
      }
    } catch {
      setError(
        'Не удалось прочитать локальный черновик. Сохранённые на сервере ростеры не затронуты.',
      );
    }
    setHydrated(true);
    void refresh().catch(problem);
    const loadLink = () => {
      const params = new URLSearchParams(location.hash.slice(1)),
        id = params.get('r') ?? params.get('m'),
        key = params.get('key') ?? '';
      if (id)
        void (params.has('r') ? openRoster(id, key) : openMatch(id, key)).catch(
          problem,
        );
    };
    loadLink();
    window.addEventListener('hashchange', loadLink);
    return () => window.removeEventListener('hashchange', loadLink);
  }, [refresh, openRoster, openMatch, problem]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        'calad.draft',
        JSON.stringify({ roster: r, catalog: d, meta, dirty }),
      );
      localStorage.setItem(
        'calad.preferences',
        JSON.stringify({ ui, lang, playerName }),
      );
    } catch {
      setError(
        'Не удалось сохранить локальный черновик: проверьте свободное место в браузере.',
      );
    }
  }, [r, d, meta, dirty, hydrated, ui, lang, playerName]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  useEffect(() => {
    if (tab !== 'matches' || !match?.id) return;
    let cancelled = false,
      inflight = false;
    const id = match.id;
    const poll = async () => {
      if (inflight) return;
      inflight = true;
      try {
        const s = await request<{ match: PublicMatch; canJoin: boolean }>(
          'match.get',
          { id, token: matchToken },
        );
        if (!cancelled) {
          acceptMatch(s.match);
          setCanJoin(s.canJoin);
          setSync('online');
        }
      } catch {
        if (!cancelled) setSync('offline');
      } finally {
        inflight = false;
      }
    };
    const interval = setInterval(() => void poll(), 2000);
    window.addEventListener('online', poll);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('online', poll);
    };
  }, [tab, match?.id, matchToken, acceptMatch]);
  useEffect(() => {
    document.documentElement.lang = ui;
  }, [ui]);
  const link = (type: string, id: string, key: string) =>
    `${location.origin}/#${type}=${encodeURIComponent(id)}${key ? `&key=${encodeURIComponent(key)}` : ''}`;
  const guardDraft = () =>
    !dirty ||
    window.confirm(
      t(
        'Оставить текущий черновик? Несохранённые изменения будут заменены.',
        'Replace the current unsaved draft?',
      ),
    );
  const save = async (copy = false) => {
    const s = await request<SavedRoster>('roster.save', {
      roster: r,
      ...(!copy && meta
        ? { id: meta.id, revision: meta.revision, token: meta.token }
        : {}),
    });
    setMeta({
      id: s.id,
      revision: s.revision,
      token: copy ? '' : (meta?.token ?? ''),
      canEdit: true,
    });
    setDirty(false);
    setNotice(t('Ростер сохранён', 'Roster saved'));
    await refresh();
    return s;
  };
  const add = (c: Character) => {
    const id = crypto.randomUUID();
    mutate((r) => ({
      ...r,
      entries: [
        ...r.entries,
        { id, characterId: c.id, notes: '', spells: [], upgrades: [] },
      ],
      leaderId: r.leaderId ?? id,
    }));
    setSelected(id);
  };
  const editEntry = (id: string, fn: (e: Entry) => Entry) =>
    mutate((r) => ({
      ...r,
      entries: r.entries.map((e) => (e.id === id ? fn(e) : e)),
    }));
  const remove = (id: string) =>
    mutate((r) => ({
      ...r,
      entries: r.entries.filter((e) => e.id !== id),
      leaderId: r.leaderId === id ? null : r.leaderId,
    }));
  const issues = validate(r, d),
    points = total(r, d),
    readOnly = !!meta && !meta.canEdit;
  const faction = tab === 'catalog' ? catalogFaction : r.factionId;
  const chars = d.characters
    .filter(
      (c) =>
        (!faction ||
          (tab === 'catalog'
            ? c.factions.includes(faction)
            : available(c, faction))) &&
        (neutral || c.factions.includes(faction)) &&
        (!classId || c.classes.includes(classId)) &&
        c.cost <= maxCost &&
        (!tag ||
          JSON.stringify((c as Character & { tags?: unknown }).tags ?? '')
            .toLowerCase()
            .includes(tag.toLowerCase())) &&
        `${c.name} ${translations[c.id] ?? ''}`
          .toLowerCase()
          .includes(q.toLowerCase()),
    )
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  const selectedEntry = r.entries.find((e) => e.id === selected),
    selectedChar = d.characters.find(
      (c) => c.id === selectedEntry?.characterId,
    );
  const reset = () => {
    setQ('');
    setClass('');
    setMaxCost(100);
    setTag('');
    setNeutral(true);
    setCatalogFaction('');
  };
  const act = async (change: MatchAction) => {
    if (!match) return;
    const s = await request<{ match: PublicMatch }>('match.act', {
      id: match.id,
      revision: match.revision,
      change,
    });
    acceptMatch(s.match);
  };
  const clipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(t('Ссылка скопирована', 'Link copied'));
    } catch {
      setNotice(value);
    }
  };
  const exportRoster = () =>
    download(`${r.name}.json`, {
      format: 'calad-roster-1',
      roster: r,
      source: d.sourceUrl,
      exportedAt: new Date().toISOString(),
    });
  const importFile = async (file: File) => {
    if (file.size > 10000000)
      throw Error('Файл слишком большой (макс. 10 МБ).');
    const pack = JSON.parse(await file.text());
    if (pack.format === 'calad-backup-1') {
      if (!Array.isArray(pack.rosters) || pack.rosters.length > 1000)
        throw Error('BAD_BACKUP');
      const drafts = pack.rosters.map((s: { roster: unknown }) =>
        parseRoster(s.roster),
      );
      if (
        !window.confirm(
          t(
            `Восстановить ${drafts.length} ростеров как новые копии?`,
            `Restore ${drafts.length} rosters as new copies?`,
          ),
        )
      )
        return;
      for (const roster of drafts) await request('roster.save', { roster });
      await refresh();
      setTab('rosters');
      setNotice(t('Копии восстановлены', 'Copies restored'));
      return;
    }
    if (pack.format !== 'calad-roster-1')
      throw Error('Неподдерживаемый формат файла.');
    const next = parseRoster(pack.roster),
      data = await request<Catalog>('catalog.get', {
        version: next.dataVersion,
      });
    if (!guardDraft()) return;
    setRoster(next);
    setData(data);
    setMeta(null);
    setDirty(true);
    setTab('builder');
  };
  const filters = (
    <>
      <label>
        {t('Поиск модели', 'Find a model')}
        <div className="search-box">
          <Search size={16} />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('Название RU / EN', 'Name EN / RU')}
          />
        </div>
      </label>
      {tab === 'catalog' && (
        <label>
          {t('Фракция', 'Faction')}
          <Select
            value={catalogFaction}
            onChange={(e) => setCatalogFaction(e.target.value)}
          >
            <Option value="">{t('Все фракции', 'All factions')}</Option>
            {d.factions.map((f) => (
              <Option key={f.id} value={f.id}>
                {name(f.id, f.name, lang)}
              </Option>
            ))}
          </Select>
        </label>
      )}
      <label>
        {t('Класс', 'Class')}
        <Select value={classId} onChange={(e) => setClass(e.target.value)}>
          <Option value="">{t('Все классы', 'All classes')}</Option>
          {d.classes.map((c) => (
            <Option key={c.id} value={c.id}>
              {name(c.id, ruleName(c), lang)}
            </Option>
          ))}
        </Select>
      </label>
      <label>
        {t('Стоимость до', 'Cost up to')}
        <Input
          type="number"
          min={0}
          max={1000}
          value={maxCost}
          onChange={(e) => setMaxCost(Number(e.target.value))}
        />
      </label>
      <label>
        {t('Тег', 'Tag')}
        <Input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder={t('Например: elite', 'e.g. elite')}
        />
      </label>
      {tab === 'builder' && (
        <label className="check">
          <input
            type="checkbox"
            checked={neutral}
            onChange={(e) => setNeutral(e.target.checked)}
          />
          {t('Показывать нейтралов', 'Include neutrals')}
        </label>
      )}
      <Button variant="ghost" onClick={reset}>
        {t('Сбросить фильтры', 'Reset filters')}
      </Button>
    </>
  );
  const catalogue = (
    <div className="catalog-content">
      <div className="section-title">
        <div>
          <p className="eyebrow">{t('СПИСОК НАБОРА', 'THE MUSTER ROLL')}</p>
          <h2>{t('Доступные модели', 'Available models')}</h2>
        </div>
        <span className="count">{chars.length}</span>
      </div>
      <div className="cards">
        {chars.map((c) => (
          <article className="unit-card" key={c.id}>
            {c.imagePath && d.mediaOrigin ? (
              <img
                src={`${d.mediaOrigin}${c.imagePath}`}
                alt=""
                loading="lazy"
                width="280"
                height="190"
              />
            ) : (
              <div className="unit-placeholder">
                <Compass />
              </div>
            )}
            <div className="unit-content">
              <div className="unit-meta">
                <span>
                  {c.classes
                    .slice(0, 2)
                    .map((id) =>
                      name(
                        id,
                        d.classes.find((x) => x.id === id)?.name ?? id,
                        lang,
                      ),
                    )
                    .join(' / ')}
                </span>
                <b>
                  {c.cost} <small>RP</small>
                </b>
              </div>
              <button
                className="unit-title"
                onClick={() => setProfile({ c, d })}
              >
                {name(c.id, c.name, lang)}
              </button>
              <p className="original" lang="en">
                {lang === 'ru' ? `EN: ${c.name}` : '\u00a0'}
              </p>
              <div className="unit-stats">
                {['STA', 'SPD', 'OFF', 'DEF', 'HP'].map((k) => (
                  <span key={k} title={ui === 'ru' ? statNames[k] : k}>
                    {k} <b>{c.stats[k]?.value ?? '—'}</b>
                  </span>
                ))}
              </div>
              <div className="row">
                <Button variant="outline" onClick={() => setProfile({ c, d })}>
                  {t('Профиль', 'Profile')}
                </Button>
                {tab === 'builder' && (
                  <Button
                    aria-label={`${t('Добавить', 'Add')} ${name(c.id, c.name, lang)}`}
                    disabled={readOnly || r.entries.length >= 10}
                    onClick={() => add(c)}
                  >
                    <Plus size={16} />
                    {t('В отряд', 'Recruit')}
                  </Button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!chars.length && (
        <div className="empty">
          <Search />
          <h3>{t('Модели не найдены', 'No models found')}</h3>
          <p>
            {t(
              'Измените запрос или сбросьте фильтры.',
              'Try another query or reset filters.',
            )}
          </p>
          <Button variant="outline" onClick={reset}>
            {t('Сбросить', 'Reset')}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        {t('К содержимому', 'Skip to content')}
      </a>
      <header className="topbar no-print">
        <div className="brand">
          <Compass />
          <span>
            CALAD GUILD<small>ELDFALL CHRONICLES</small>
          </span>
        </div>
        <nav aria-label={t('Главная навигация', 'Main navigation')}>
          {[
            ['builder', 'Билдер', 'Builder'],
            ['rosters', 'Мои ростеры', 'My rosters'],
            ['matches', 'Матчи', 'Matches'],
            ['catalog', 'Справочник', 'Reference'],
          ].map(([id, ru, en]) => (
            <button
              key={id}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => {
                setTab(id);
                if (id === 'rosters' || id === 'matches')
                  void refresh().catch(problem);
              }}
            >
              {t(ru, en)}
            </button>
          ))}
        </nav>
        <div className="language-controls">
          <label htmlFor="ui-language">
            {t('Интерфейс', 'Interface')}
            <Select
              id="ui-language"
              aria-label={t('Язык интерфейса', 'Interface language')}
              value={ui}
              onChange={(e) => setUi(e.target.value as Lang)}
            >
              <Option value="ru">RU · Русский</Option>
              <Option value="en">EN · English</Option>
            </Select>
          </label>
          <label>
            {t('Игровые тексты', 'Game text')}
            <Select
              id="data-language"
              aria-label={t('Язык игровых текстов', 'Game data language')}
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
            >
              <Option value="ru">RU · Русский</Option>
              <Option value="en">EN · English</Option>
            </Select>
          </label>
        </div>
      </header>
      {hydrated && !boot.userId && (
        <div className="message no-print">
          <span>
            {t(
              'Для сохранения и матчей нужен вход.',
              'Sign in to save rosters and play matches.',
            )}
          </span>
          <a href="/signin-with-chatgpt?return_to=/" target="_top">
            {t('Войти через ChatGPT', 'Sign in with ChatGPT')} →
          </a>
        </div>
      )}
      <main id="main">
        <div className="workspace-head no-print">
          <div>
            <p className="eyebrow">
              {t('ВАША СЛЕДУЮЩАЯ ЭКСПЕДИЦИЯ', 'YOUR NEXT EXPEDITION')}
            </p>
            <h1>
              {tab === 'builder'
                ? t('Соберите свою историю.', 'Assemble your story.')
                : tab === 'rosters'
                  ? t('Отряды в вашем журнале.', 'Your expedition journal.')
                  : tab === 'matches'
                    ? t('Встретимся на поле боя.', 'Meet on the battlefield.')
                    : t(
                        'Мир Калáда, в деталях.',
                        'The world of Calad, in detail.',
                      )}
            </h1>
            <p>
              {t(
                'Личный журнал отрядов и партий Eldfall Chronicles.',
                'Your private Eldfall Chronicles roster and match companion.',
              )}
            </p>
          </div>
          <div className="edition">
            {t('ПРАВИЛА', 'RULEBOOK')}
            <br />
            <strong>1.6</strong>
            <br />
            {t('ИСПРАВЛЕНИЯ · АПР 2026', 'ERRATA · APR 2026')}
          </div>
        </div>
        {error && (
          <div className="message error no-print" role="alert">
            {errorText(error, ui)}
            <Button variant="ghost" onClick={() => setError('')}>
              {t('Закрыть', 'Dismiss')}
            </Button>
          </div>
        )}
        {notice && (
          <output className="message no-print">
            {notice}
            <Button variant="ghost" onClick={() => setNotice('')}>
              ×
            </Button>
          </output>
        )}
        {links.length > 0 && (
          <div className="share-panel no-print">
            <h2>{t('Приватные ссылки', 'Private links')}</h2>
            <p>
              {t(
                'Получателю также нужен доступ к этому сайту. Не передавайте ссылку редактирования посторонним.',
                'Recipients also need access to this site. Keep edit links private.',
              )}
            </p>
            {links.map((x) => (
              <div key={x.label}>
                <label>
                  {x.label}
                  <Input readOnly value={x.url} />
                </label>
                <Button variant="outline" onClick={() => void clipboard(x.url)}>
                  <Copy size={16} />
                  {t('Копировать', 'Copy')}
                </Button>
              </div>
            ))}
            <Button variant="ghost" onClick={() => setLinks([])}>
              {t('Скрыть', 'Hide')}
            </Button>
          </div>
        )}
        {(tab === 'builder' || tab === 'catalog') && (
          <div
            className={`builder no-print ${tab === 'catalog' ? 'reference-layout' : ''}`}
          >
            <aside className="panel filters">
              <p className="eyebrow">01 / {t('ПОДГОТОВКА', 'PREPARATION')}</p>
              {tab === 'builder' && (
                <>
                  <label>
                    {t('Фракция отряда', 'Party faction')}
                    <Select
                      value={r.factionId}
                      disabled={readOnly}
                      onChange={(e) =>
                        mutate((r) => ({ ...r, factionId: e.target.value }))
                      }
                    >
                      {d.factions.map((f) => (
                        <Option key={f.id} value={f.id}>
                          {name(f.id, f.name, lang)}
                        </Option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    {t('Лимит очков', 'Point limit')}
                    <Input
                      disabled={readOnly}
                      type="number"
                      min={1}
                      max={1000}
                      value={r.pointsLimit}
                      onChange={(e) =>
                        mutate((r) => ({
                          ...r,
                          pointsLimit: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                  <div className="row">
                    {[65, 85].map((n) => (
                      <Button
                        key={n}
                        variant="outline"
                        disabled={readOnly}
                        onClick={() =>
                          mutate((r) => ({ ...r, pointsLimit: n }))
                        }
                      >
                        {n} RP
                      </Button>
                    ))}
                  </div>
                  <hr />
                </>
              )}
              {filters}
              <hr />
              <p className="source-note">
                {t(
                  'Русский перевод — неофициальный черновик. Английский оригинал доступен в каждой карточке правил.',
                  'Russian translations are unofficial drafts. Each rule card includes its English original.',
                )}
              </p>
            </aside>
            <section className="panel parchment">{catalogue}</section>
            {tab === 'builder' && (
              <aside className="panel roster-panel">
                <p className="eyebrow">02 / {t('ВАШ ОТРЯД', 'YOUR PARTY')}</p>
                <label className="sr-only" htmlFor="roster-name">
                  {t('Название ростера', 'Roster name')}
                </label>
                <Input
                  id="roster-name"
                  className="roster-name"
                  maxLength={120}
                  disabled={readOnly}
                  value={r.name}
                  onChange={(e) =>
                    mutate((r) => ({ ...r, name: e.target.value }))
                  }
                />
                <div
                  className={`budget ${points > r.pointsLimit ? 'over' : ''}`}
                >
                  {points}
                  <small> / {r.pointsLimit} RP</small>
                </div>
                <progress
                  value={Math.min(points, r.pointsLimit)}
                  max={r.pointsLimit || 1}
                  aria-label={t('Бюджет набора', 'Recruitment budget')}
                />
                <p className="muted">
                  {r.entries.length} / 10 {t('моделей', 'models')} ·{' '}
                  {r.pointsLimit - points} RP {t('осталось', 'remaining')}
                </p>
                {d.version !== latest.version && (
                  <p className="warning">
                    {t(
                      'Есть новая версия данных. Этот ростер сохранён на старой.',
                      'New data available. This roster uses its original version.',
                    )}
                  </p>
                )}
                {readOnly && (
                  <p className="warning">
                    {t(
                      'Только просмотр. Можно сохранить свою копию.',
                      'Read-only. Save a copy to edit.',
                    )}
                  </p>
                )}
                {!r.entries.length && (
                  <div className="empty roster-empty">
                    <Compass />
                    <h3>{t('Первый шаг — герой.', 'Start with a hero.')}</h3>
                    <p>
                      {t(
                        'Выберите модель в каталоге и добавьте её в отряд.',
                        'Recruit your first model from the catalogue.',
                      )}
                    </p>
                  </div>
                )}
                <ol className="roster-list">
                  {r.entries.map((e, i) => {
                    const c = d.characters.find((c) => c.id === e.characterId);
                    return (
                      <li
                        key={e.id}
                        className={selected === e.id ? 'selected' : ''}
                      >
                        <button
                          className="roster-entry"
                          onClick={() =>
                            setSelected(selected === e.id ? null : e.id)
                          }
                        >
                          <span className="entry-number">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span>
                            {c ? name(c.id, c.name, lang) : e.characterId}
                            {r.leaderId === e.id && (
                              <Crown
                                size={14}
                                aria-label={t('Лидер', 'Leader')}
                              />
                            )}
                            <small>
                              {e.upgrades.length
                                ? `${e.upgrades.length} ${t('улучш.', 'upgrades')} · `
                                : ''}
                              {c
                                ? c.cost +
                                  e.upgrades.reduce(
                                    (n, u) => n + upgradeCost(u.id, c, e, r, d),
                                    0,
                                  )
                                : '?'}{' '}
                              RP
                            </small>
                          </span>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${t('Удалить', 'Remove')} ${c ? name(c.id, c.name, lang) : e.characterId}`}
                          disabled={readOnly}
                          onClick={() => remove(e.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </li>
                    );
                  })}
                </ol>
                <div className="validation" aria-live="polite">
                  {issues.length ? (
                    <>
                      <b>
                        {t('Проверка состава', 'Roster check')} ·{' '}
                        {issues.length}
                      </b>
                      <ul>
                        {issues.map((x, i) => (
                          <li key={`${x.code}-${i}`}>
                            <button
                              onClick={() =>
                                x.entryId && setSelected(x.entryId)
                              }
                            >
                              {issueText(x, ui, d)}
                            </button>{' '}
                            <a
                              href={x.source}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={t('Источник правила', 'Rule source')}
                            >
                              ↗
                            </a>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="valid">
                      <ShieldCheck size={18} />
                      {t('Проверки состава пройдены', 'Roster checks passed')}
                    </p>
                  )}
                </div>
                <label>
                  {t('Заметки отряда', 'Roster notes')}
                  <textarea
                    disabled={readOnly}
                    maxLength={5000}
                    value={r.notes}
                    onChange={(e) =>
                      mutate((r) => ({ ...r, notes: e.target.value }))
                    }
                  />
                </label>
                <div className="stack">
                  <Button
                    disabled={busy || readOnly}
                    onClick={() =>
                      void run(async () => {
                        await save();
                      })
                    }
                  >
                    <Save size={17} />
                    {dirty
                      ? t('Сохранить изменения', 'Save changes')
                      : t('Сохранить ростер', 'Save roster')}
                  </Button>
                  <Button
                    disabled={busy}
                    variant="outline"
                    onClick={() =>
                      void run(async () => {
                        await save(true);
                      })
                    }
                  >
                    <Copy size={16} />
                    {t('Сохранить копию', 'Save a copy')}
                  </Button>
                  <Button
                    disabled={busy || !!issues.length || readOnly}
                    variant="outline"
                    onClick={() =>
                      void run(async () => {
                        const saved = await save();
                        const s = await request<{
                          match: PublicMatch;
                          inviteToken: string;
                          viewToken: string;
                        }>('match.create', {
                          rosterId: saved.id,
                          name: playerName,
                        });
                        acceptMatch(s.match);
                        setMatchToken('');
                        setCanJoin(false);
                        setTab('matches');
                        setLinks([
                          {
                            label: t('Пригласить соперника', 'Invite opponent'),
                            url: link('m', s.match.id, s.inviteToken),
                          },
                          {
                            label: t('Код приглашения', 'Invitation code'),
                            url: s.inviteToken,
                          },
                          {
                            label: t('Наблюдатель', 'Spectator'),
                            url: link('m', s.match.id, s.viewToken),
                          },
                        ]);
                        await refresh();
                      })
                    }
                  >
                    <Swords size={17} />
                    {t('Создать матч', 'Create match')}
                  </Button>
                </div>
                <div className="tools">
                  <Button variant="ghost" onClick={exportRoster}>
                    <Download size={16} />
                    JSON
                  </Button>
                  <Button variant="ghost" onClick={() => window.print()}>
                    <Printer size={16} />
                    {t('Печать', 'Print')}
                  </Button>
                  {meta && (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const keys = await request<{
                            readToken: string;
                            editToken: string;
                          }>('roster.links', { id: meta.id });
                          setLinks([
                            {
                              label: t('Просмотр', 'View'),
                              url: link('r', meta.id, keys.readToken),
                            },
                            {
                              label: t('Редактирование', 'Edit'),
                              url: link('r', meta.id, keys.editToken),
                            },
                          ]);
                          setNotice(
                            t(
                              'Созданы новые ссылки. Старые ссылки отозваны.',
                              'New links created. Previous links revoked.',
                            ),
                          );
                        })
                      }
                    >
                      <ExternalLink size={16} />
                      {t('Ссылки', 'Links')}
                    </Button>
                  )}
                </div>
                <small className="version">
                  {d.version}
                  {meta ? ` · ${t('версия', 'rev')} ${meta.revision}` : ''}
                </small>
              </aside>
            )}
          </div>
        )}
        {tab === 'builder' && selectedEntry && selectedChar && (
          <section className="entry-editor no-print">
            <div className="section-title">
              <div>
                <p className="eyebrow">03 / {t('СНАРЯЖЕНИЕ', 'LOADOUT')}</p>
                <h2>{name(selectedChar.id, selectedChar.name, lang)}</h2>
              </div>
              <div className="row">
                <Button
                  variant="outline"
                  onClick={() => setProfile({ c: selectedChar, d })}
                >
                  <BookOpen size={16} />
                  {t('Полный профиль', 'Full profile')}
                </Button>
                <Button variant="ghost" onClick={() => setSelected(null)}>
                  {t('Свернуть', 'Collapse')}
                </Button>
              </div>
            </div>
            <Stats
              character={upgraded(selectedChar, selectedEntry, d)}
              lang={ui}
            />
            <p className="source-note">
              {t(
                'Показаны базовые характеристики с числовыми бонусами улучшений. Условные эффекты и замены оружия применяйте по карточке.',
                'Base attributes with numeric upgrade bonuses. Apply conditional effects and weapon replacements using the upgrade card.',
              )}
            </p>
            <div className="row">
              <Button
                disabled={readOnly}
                variant={
                  r.leaderId === selectedEntry.id ? 'default' : 'outline'
                }
                onClick={() =>
                  mutate((r) => ({ ...r, leaderId: selectedEntry.id }))
                }
              >
                <Crown size={16} />
                {t('Назначить лидером', 'Party leader')}
              </Button>
              <Button
                disabled={readOnly || r.entries.length >= 10}
                variant="outline"
                onClick={() => {
                  const id = crypto.randomUUID();
                  mutate((r) => ({
                    ...r,
                    entries: [
                      ...r.entries,
                      { ...structuredClone(selectedEntry), id },
                    ],
                  }));
                  setSelected(id);
                }}
              >
                <Copy size={16} />
                {t('Дублировать модель', 'Duplicate model')}
              </Button>
            </div>
            <div className="loadout-columns">
              {selectedChar.id === 'DJINNBORN_MARZBAN' && (
                <section>
                  <label>
                    {t('Стихия Мерзбана', 'Marzban element')}
                    <Select
                      disabled={readOnly}
                      value={selectedEntry.element ?? ''}
                      onChange={(event) =>
                        editEntry(selectedEntry.id, (e) => ({
                          ...e,
                          element: event.target.value,
                          spells: [],
                        }))
                      }
                    >
                      <Option value="">
                        {t('Выберите одну стихию…', 'Choose one element…')}
                      </Option>
                      {['FIRE', 'AIR', 'EARTH', 'WATER', 'ELDER'].map(
                        (element) => (
                          <Option key={element} value={element}>
                            {term(element, lang)}
                          </Option>
                        ),
                      )}
                    </Select>
                  </label>
                  <p className="source-note">
                    {t(
                      'Определяет сродство, сопротивление и доступные заклинания. При смене стихии памятка заклинаний очищается.',
                      'Determines affinity, resistance and available spells. Changing the element clears selected spell references.',
                    )}
                  </p>
                </section>
              )}
              <section>
                <h3>{t('Улучшения', 'Upgrades')}</h3>
                <label>
                  {t('Добавить улучшение', 'Add upgrade')}
                  <Select
                    value=""
                    disabled={readOnly}
                    onChange={(e) => {
                      if (e.target.value)
                        editEntry(selectedEntry.id, (x) => ({
                          ...x,
                          upgrades: [
                            ...x.upgrades,
                            { id: e.target.value, choice: '' },
                          ],
                        }));
                    }}
                  >
                    <Option value="">
                      {t('Выберите карточку…', 'Choose a card…')}
                    </Option>
                    {upgrades
                      .filter((u) =>
                        u.factions.some((f) =>
                          [r.factionId, 'NEUTRAL'].includes(f),
                        ),
                      )
                      .map((u) => (
                        <Option key={u.id} value={u.id}>
                          {upgradeName(u, lang)} · {u.cost} RP
                        </Option>
                      ))}
                  </Select>
                </label>
                {selectedEntry.upgrades.map((u, index) => {
                  const spec = upgrades.find((x) => x.id === u.id),
                    options = upgradeOptions(u.id, selectedChar, d);
                  return (
                    <div className="upgrade" key={`${u.id}-${index}`}>
                      <div className="row">
                        <b>{spec ? upgradeName(spec, lang) : u.id}</b>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={readOnly}
                          aria-label={t('Удалить улучшение', 'Remove upgrade')}
                          onClick={() =>
                            editEntry(selectedEntry.id, (e) => ({
                              ...e,
                              upgrades: e.upgrades.filter(
                                (_, i) => i !== index,
                              ),
                            }))
                          }
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                      {options.length > 0 && (
                        <label>
                          {t('Вариант', 'Option')}
                          <Select
                            disabled={readOnly}
                            value={u.choice}
                            onChange={(e) =>
                              editEntry(selectedEntry.id, (x) => ({
                                ...x,
                                upgrades: x.upgrades.map((v, i) =>
                                  i === index
                                    ? { ...v, choice: e.target.value }
                                    : v,
                                ),
                              }))
                            }
                          >
                            <Option value="">—</Option>
                            {options.map((s) => (
                              <Option key={s} value={s}>
                                {term(s, lang)}
                              </Option>
                            ))}
                          </Select>
                        </label>
                      )}
                      <details>
                        <summary>
                          {t('Текст карточки', 'Card text')} · {spec?.cost} RP
                        </summary>
                        {spec &&
                          lang === 'ru' &&
                          !translationCurrent(`upgrade:${spec.id}`, spec) && (
                            <p className="warning">
                              {t(
                                'Источник изменился: показан английский оригинал до проверки перевода.',
                                'Source changed: showing English until translation review.',
                              )}
                            </p>
                          )}
                        <p
                          className="rule-text"
                          lang={
                            spec &&
                            lang === 'ru' &&
                            translationCurrent(`upgrade:${spec.id}`, spec)
                              ? 'ru'
                              : 'en'
                          }
                        >
                          {spec && upgradeText(spec, lang)}
                        </p>
                        {spec && lang === 'ru' && (
                          <details>
                            <summary>
                              {t('Оригинал (EN)', 'English original')}
                            </summary>
                            <p lang="en">{spec.description}</p>
                          </details>
                        )}
                        <a
                          href={`${UPGRADE_SOURCE}#page=${spec?.page}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          v1.6 · {t('с.', 'p.')} {spec?.page} ↗
                        </a>
                      </details>
                    </div>
                  );
                })}
              </section>
              <section>
                <h3>
                  {t('Заклинания для памятки', 'Spell reference selection')}
                </h3>
                <p className="muted">
                  {t(
                    'Это удобный список доступных заклинаний, не покупка магии.',
                    'A handy selection of available spells, not a spell purchase.',
                  )}
                </p>
                {spellsFor(upgraded(selectedChar, selectedEntry, d), d).map(
                  (s) => (
                    <div className="spell-choice" key={`${s.schoolId}-${s.id}`}>
                      <label className="check">
                        <input
                          disabled={readOnly}
                          type="checkbox"
                          checked={selectedEntry.spells.includes(s.id)}
                          onChange={(e) =>
                            editEntry(selectedEntry.id, (x) => ({
                              ...x,
                              spells: e.target.checked
                                ? [...x.spells, s.id]
                                : x.spells.filter((id) => id !== s.id),
                            }))
                          }
                        />
                        {ruleName(s, lang)} · {s.level} ·{' '}
                        {term(s.element, lang)}
                      </label>
                      <Rule record={s} lang={lang} ui={ui} />
                    </div>
                  ),
                )}
              </section>
              <section>
                <label>
                  {t('Заметки модели', 'Model notes')}
                  <textarea
                    disabled={readOnly}
                    maxLength={2000}
                    value={selectedEntry.notes}
                    onChange={(e) =>
                      editEntry(selectedEntry.id, (x) => ({
                        ...x,
                        notes: e.target.value,
                      }))
                    }
                  />
                </label>
                <p className="source-note">
                  {t(
                    'Изменения сохраняются вместе с ростером.',
                    'Changes are saved with the roster.',
                  )}
                </p>
              </section>
            </div>
          </section>
        )}
        {tab === 'rosters' && (
          <section className="wide-panel no-print">
            <div className="section-title">
              <h2>
                {t('Мои ростеры', 'My rosters')}{' '}
                <span className="count">{boot.rosters.length}</span>
              </h2>
              <div className="row">
                <Button
                  onClick={() => {
                    if (guardDraft()) {
                      setRoster({
                        ...freshRoster(latest),
                        name:
                          ui === 'en' ? 'New expedition' : 'Новая экспедиция',
                      });
                      setData(latest);
                      setMeta(null);
                      setDirty(true);
                      setTab('builder');
                      setSelected(null);
                    }
                  }}
                >
                  <Plus size={16} />
                  {t('Новый ростер', 'New roster')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => importRef.current?.click()}
                >
                  <Upload size={16} />
                  {t('Импорт / восстановление', 'Import / restore')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    download('calad-backup.json', {
                      format: 'calad-backup-1',
                      exportedAt: new Date().toISOString(),
                      rosters: boot.rosters,
                    })
                  }
                >
                  <Download size={16} />
                  {t('Резервная копия', 'Backup')}
                </Button>
              </div>
            </div>
            {!boot.rosters.length ? (
              <div className="empty">
                <BookOpen />
                <h3>{t('Журнал пока пуст', 'Your journal is empty')}</h3>
                <p>
                  {t(
                    'Сохраните первый отряд в билдере.',
                    'Save your first roster in the builder.',
                  )}
                </p>
              </div>
            ) : (
              <div className="saved-grid">
                {boot.rosters.map((s) => (
                  <article className="saved-card" key={s.id}>
                    <p className="eyebrow">{term(s.roster.factionId, lang)}</p>
                    <h3>{s.roster.name}</h3>
                    <p>
                      {s.roster.entries.length} {t('моделей', 'models')} ·{' '}
                      {s.roster.pointsLimit} RP
                    </p>
                    <small>
                      {new Date(s.updatedAt).toLocaleString(ui)} ·{' '}
                      {t('версия', 'rev')} {s.revision}
                    </small>
                    <div className="row">
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          if (guardDraft()) void run(() => openRoster(s.id));
                        }}
                      >
                        {t('Открыть', 'Open')}
                        <ArrowRight size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await openRoster(s.id);
                            setHistory(
                              await request('roster.history', { id: s.id }),
                            );
                          })
                        }
                      >
                        <RotateCcw size={16} />
                        {t('Версии', 'Versions')}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        {history.length > 0 && tab === 'builder' && (
          <section className="wide-panel no-print">
            <h2>{t('История сохранений', 'Saved revisions')}</h2>
            <p>
              {t(
                'Восстановление открывает отдельный черновик и не перезаписывает оригинал.',
                'Restore opens a separate draft without overwriting the original.',
              )}
            </p>
            {history.map((h) => (
              <div className="history-row" key={h.revision}>
                <span>
                  {t('Версия', 'Revision')} {h.revision} ·{' '}
                  {new Date(h.updated).toLocaleString(ui)}
                </span>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (guardDraft()) {
                      setRoster(parseRoster(JSON.parse(h.payload)));
                      setMeta(null);
                      setDirty(true);
                      setHistory([]);
                    }
                  }}
                >
                  {t('Восстановить копию', 'Restore copy')}
                </Button>
              </div>
            ))}
          </section>
        )}
        {tab === 'catalog' && (
          <section className="wide-panel no-print">
            <h2>{t('Правила и справочники', 'Rules and references')}</h2>
            <div className="resource-links">
              <a href={SOURCES.core} target="_blank" rel="noreferrer">
                {t('Книга правил', 'Rulebook')} v1.6 ↗
              </a>
              <a href={SOURCES.errata} target="_blank" rel="noreferrer">
                {t('Исправления: апрель 2026', 'Errata April 2026')} ↗
              </a>
              <a href={UPGRADE_SOURCE} target="_blank" rel="noreferrer">
                {t('Карточки улучшений', 'Upgrade cards')} v1.6 ↗
              </a>
              <a
                href="https://drive.google.com/file/d/1sArYJbxiVc0t9z8OvyDsTM45-atJa3qU/view"
                target="_blank"
                rel="noreferrer"
              >
                {t('Схемы', 'Schemes')} v1.6 ↗
              </a>
            </div>
            <div className="reference-sections">
              {(
                [
                  ['Classes', d.classes],
                  ['Traits', d.traits],
                  ['Skills', d.skills],
                  ['Combat arts', d.combatArts],
                  ['Stratagems', d.stratagems],
                  ['Items', d.items],
                  ...d.schools.map((s) => [name(s.id, s.name, lang), s.spells]),
                ] as [string, typeof d.classes][]
              ).map(([title, records]) => (
                <details key={title}>
                  <summary>
                    {term(title, ui)}{' '}
                    <small>{(records as typeof d.classes).length}</small>
                  </summary>
                  {(records as typeof d.classes).map((rec, i) => (
                    <Rule
                      key={`${rec.id}-${i}`}
                      record={rec}
                      lang={lang}
                      ui={ui}
                    />
                  ))}
                </details>
              ))}
            </div>
          </section>
        )}
        {tab === 'matches' && (
          <section className="wide-panel no-print">
            <div className="section-title">
              <h2>{t('Матчевый журнал', 'Match journal')}</h2>
              <label>
                {t('Ваше имя в матче', 'Your player name')}
                <Input
                  maxLength={80}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder={t('Игрок', 'Player')}
                />
              </label>
            </div>
            <div className="join-code">
              <label>
                {t('Код приглашения', 'Invitation code')}
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.trim().toLowerCase())}
                  maxLength={16}
                  placeholder={t('16 символов', '16 characters')}
                />
              </label>
              <Button
                disabled={busy || code.length !== 16}
                onClick={() =>
                  void run(async () => {
                    const x = await request<{ id: string }>('match.find', {
                      token: code,
                    });
                    await openMatch(x.id, code);
                  })
                }
              >
                {t('Открыть приглашение', 'Open invitation')}
              </Button>
            </div>
            {match ? (
              <>
                <div className="match-toolbar">
                  <div>
                    <p className="eyebrow">
                      {t('МАТЧ', 'MATCH')} · {match.id.slice(0, 8)} ·{' '}
                      {t('ВЕРСИЯ', 'REV')} {match.revision}
                    </p>
                    <h2>
                      {t('Раунд', 'Round')} {match.play.round}{' '}
                      <span className="status-pill">
                        {term(match.status, ui)}
                      </span>
                    </h2>
                  </div>
                  <p className={sync === 'offline' ? 'warning' : 'muted'}>
                    {sync === 'offline' ? (
                      <>
                        <WifiOff size={16} />{' '}
                        {t(
                          'Нет связи. Повторное подключение…',
                          'Offline. Reconnecting…',
                        )}
                      </>
                    ) : (
                      t('Синхронизация каждые 2 сек.', 'Synced every 2 seconds')
                    )}
                  </p>
                </div>
                <p className="source-note">
                  {t(
                    'Трекер для игры на столе: броски, активации, призывы и эффекты разыгрываются игроками. Раунд не сбрасывает ресурсы автоматически.',
                    'Tabletop tracker: players resolve dice, activations, summons and effects. Advancing rounds does not automatically reset resources.',
                  )}
                </p>
                {canJoin && (
                  <div className="join-code">
                    <label>
                      {t(
                        'Выберите свой сохранённый ростер',
                        'Choose your saved roster',
                      )}
                      <Select
                        value={joinRoster}
                        onChange={(e) => setJoinRoster(e.target.value)}
                      >
                        <Option value="">—</Option>
                        {boot.rosters.map((s) => (
                          <Option key={s.id} value={s.id}>
                            {s.roster.name} · {s.roster.pointsLimit} RP
                          </Option>
                        ))}
                      </Select>
                    </label>
                    <Button
                      disabled={busy || !joinRoster}
                      onClick={() =>
                        void run(async () => {
                          const s = await request<{ match: PublicMatch }>(
                            'match.join',
                            {
                              id: match.id,
                              revision: match.revision,
                              token: matchToken,
                              rosterId: joinRoster,
                              name: playerName,
                            },
                          );
                          acceptMatch(s.match);
                          setCanJoin(false);
                          await refresh();
                        })
                      }
                    >
                      {t('Присоединиться', 'Join match')}
                    </Button>
                  </div>
                )}
                {match.status === 'waiting' && (
                  <p className="message">
                    {t(
                      'Ожидаем соперника. Приглашение доступно по созданной ссылке или коду.',
                      'Waiting for an opponent to open the invite link or code.',
                    )}
                  </p>
                )}
                <div className="match-sides">
                  {match.players.map((p, side) => {
                    const own = p.userId === boot.userId,
                      active = own && match.status === 'active',
                      locked = busy || !active || sync === 'offline';
                    return (
                      <section className={`side side-${side}`} key={p.userId}>
                        <p className="eyebrow">
                          {side === 0 ? 'I /' : 'II /'} {p.name} ·{' '}
                          {own ? t('ВЫ', 'YOU') : t('СОПЕРНИК', 'OPPONENT')}
                        </p>
                        <h3>{p.roster.name}</h3>
                        <p>
                          {total(p.roster, p.catalog)} / {p.roster.pointsLimit}{' '}
                          RP · {p.roster.entries.length}{' '}
                          {t('моделей', 'models')}
                        </p>
                        <small>
                          {p.roster.dataVersion} · {t('Правила', 'Rules')}{' '}
                          {term(p.roster.rulesVersion, ui)}
                        </small>
                        <div className="row">
                          <span className="status-pill">
                            {p.ready
                              ? t('Подтверждено', 'Confirmed')
                              : t('Не подтверждено', 'Unconfirmed')}
                          </span>
                          <Button
                            variant={
                              match.play.activeSide === side
                                ? 'default'
                                : 'outline'
                            }
                            disabled={
                              busy ||
                              !match.players.some(
                                (x) => x.userId === boot.userId,
                              ) ||
                              match.status !== 'active'
                            }
                            onClick={() =>
                              void run(() =>
                                act({ type: 'initiative', value: side }),
                              )
                            }
                          >
                            {t('Инициатива', 'Initiative')}
                            {match.play.activeSide === side ? ' ✓' : ''}
                          </Button>
                        </div>
                        <div className="score-control">
                          <span title={t('Победные очки', 'Victory points')}>
                            {t('ПО', 'VP')}
                          </span>
                          <Button
                            variant="outline"
                            disabled={locked}
                            aria-label={t(
                              'Уменьшить победные очки',
                              'Decrease victory points',
                            )}
                            onClick={() =>
                              void run(() =>
                                act({
                                  type: 'score',
                                  value: match.play.score[side] - 1,
                                }),
                              )
                            }
                          >
                            −
                          </Button>
                          <strong>{match.play.score[side]}</strong>
                          <Button
                            variant="outline"
                            disabled={locked}
                            aria-label={t(
                              'Увеличить победные очки',
                              'Increase victory points',
                            )}
                            onClick={() =>
                              void run(() =>
                                act({
                                  type: 'score',
                                  value: match.play.score[side] + 1,
                                }),
                              )
                            }
                          >
                            +
                          </Button>
                        </div>
                        {p.roster.entries.map((e) => {
                          const c = p.catalog.characters.find(
                              (c) => c.id === e.characterId,
                            )!,
                            key = `${side}:${e.id}`,
                            u = match.play.units[key];
                          return (
                            <article className="match-unit" key={e.id}>
                              <button
                                className="unit-title"
                                onClick={() =>
                                  setProfile({
                                    c: upgraded(c, e, p.catalog),
                                    d: p.catalog,
                                  })
                                }
                              >
                                {name(c.id, c.name, lang)}
                                {p.roster.leaderId === e.id && (
                                  <Crown size={16} />
                                )}
                              </button>
                              {e.upgrades.length > 0 && (
                                <p className="muted">
                                  {e.upgrades
                                    .map(
                                      (u) =>
                                        `${upgradeName((p.catalog.upgrades ?? UPGRADES).find((x) => x.id === u.id) ?? { id: u.id, name: u.id }, lang)}${u.choice ? ` (${term(u.choice, lang)})` : ''}`,
                                    )
                                    .join(' · ')}
                                </p>
                              )}
                              {u && (
                                <>
                                  <div className="counters">
                                    {(['hp', 'ap', 'mana'] as const).map(
                                      (field) => (
                                        <div key={field}>
                                          <label>{term(field, ui)}</label>
                                          <div>
                                            <Button
                                              size="icon"
                                              variant="outline"
                                              disabled={
                                                locked || u[field] === 0
                                              }
                                              aria-label={`${t('Уменьшить', 'Decrease')} ${term(field, ui)}`}
                                              onClick={() =>
                                                void run(() =>
                                                  act({
                                                    type: 'unit',
                                                    key,
                                                    field,
                                                    value: u[field] - 1,
                                                  }),
                                                )
                                              }
                                            >
                                              −
                                            </Button>
                                            <b>{u[field]}</b>
                                            <Button
                                              size="icon"
                                              variant="outline"
                                              disabled={
                                                locked || u[field] === 100
                                              }
                                              aria-label={`${t('Увеличить', 'Increase')} ${term(field, ui)}`}
                                              onClick={() =>
                                                void run(() =>
                                                  act({
                                                    type: 'unit',
                                                    key,
                                                    field,
                                                    value: u[field] + 1,
                                                  }),
                                                )
                                              }
                                            >
                                              +
                                            </Button>
                                          </div>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                  <div className="states">
                                    {u.states.map((s) => (
                                      <button
                                        key={s}
                                        disabled={locked}
                                        title={t(
                                          'Снять состояние',
                                          'Remove state',
                                        )}
                                        onClick={() =>
                                          void run(() =>
                                            act({
                                              type: 'unit',
                                              key,
                                              field: 'states',
                                              value: u.states.filter(
                                                (x) => x !== s,
                                              ),
                                            }),
                                          )
                                        }
                                      >
                                        {lang === 'ru'
                                          ? (stateNames[s] ?? s)
                                          : s}{' '}
                                        {own ? '×' : ''}
                                      </button>
                                    ))}
                                  </div>
                                  {own && (
                                    <Select
                                      aria-label={t(
                                        'Добавить состояние',
                                        'Add state',
                                      )}
                                      disabled={locked}
                                      value=""
                                      onChange={(e) => {
                                        if (e.target.value)
                                          void run(() =>
                                            act({
                                              type: 'unit',
                                              key,
                                              field: 'states',
                                              value: [
                                                ...u.states,
                                                e.target.value,
                                              ],
                                            }),
                                          );
                                      }}
                                    >
                                      <Option value="">
                                        {t('Добавить состояние…', 'Add state…')}
                                      </Option>
                                      {STATES.filter(
                                        (s) => !u.states.includes(s),
                                      ).map((s) => (
                                        <Option key={s} value={s}>
                                          {lang === 'ru'
                                            ? (stateNames[s] ?? s)
                                            : s}
                                        </Option>
                                      ))}
                                    </Select>
                                  )}
                                </>
                              )}
                              {e.notes && <p className="note">{e.notes}</p>}
                              {e.element && (
                                <p>
                                  {t('Стихия', 'Element')}:{' '}
                                  {term(e.element, lang)}
                                </p>
                              )}
                            </article>
                          );
                        })}
                        {own && match.status === 'confirming' && (
                          <Button
                            disabled={busy}
                            onClick={() =>
                              void run(() => act({ type: 'ready' }))
                            }
                          >
                            {p.ready
                              ? t(
                                  'Отменить подтверждение',
                                  'Withdraw confirmation',
                                )
                              : t('Подтвердить состав', 'Confirm roster')}
                          </Button>
                        )}
                      </section>
                    );
                  })}
                </div>
                {match.players.some((p) => p.userId === boot.userId) && (
                  <div className="match-actions">
                    {match.status === 'active' && (
                      <>
                        <Button
                          disabled={
                            busy ||
                            match.players[match.play.activeSide]?.userId !==
                              boot.userId
                          }
                          onClick={() => {
                            if (
                              window.confirm(
                                t(
                                  'Начать следующий раунд? Ресурсы останутся без изменений.',
                                  'Advance the round? Resources will not reset.',
                                ),
                              )
                            )
                              void run(() => act({ type: 'round' }));
                          }}
                        >
                          {t('Следующий раунд', 'Next round')}
                          <ArrowRight size={16} />
                        </Button>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => void run(() => act({ type: 'pause' }))}
                        >
                          {t('Пауза', 'Pause')}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={busy || match.undo?.actor !== boot.userId}
                          onClick={() => void run(() => act({ type: 'undo' }))}
                        >
                          <RotateCcw size={16} />
                          {t('Отменить действие', 'Undo last action')}
                        </Button>
                      </>
                    )}
                    {match.status === 'paused' && (
                      <Button
                        disabled={busy}
                        onClick={() => void run(() => act({ type: 'resume' }))}
                      >
                        {t('Продолжить', 'Resume')}
                      </Button>
                    )}
                    {['active', 'paused'].includes(match.status) && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          const result = window.prompt(
                            t(
                              'Результат, победитель и заметка (после завершения редактирование будет закрыто):',
                              'Result, winner and notes (finishing locks the match):',
                            ),
                          );
                          if (result?.trim())
                            void run(async () => {
                              await act({ type: 'finish', result });
                              await refresh();
                            });
                        }}
                      >
                        {t('Завершить матч', 'Finish match')}
                      </Button>
                    )}
                    {match.players[0].userId === boot.userId && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const keys = await request<{
                              inviteToken: string;
                              viewToken: string;
                            }>('match.links', {
                              id: match.id,
                              revision: match.revision,
                            });
                            setLinks([
                              ...(match.status === 'waiting'
                                ? [
                                    {
                                      label: t(
                                        'Пригласить соперника',
                                        'Invite opponent',
                                      ),
                                      url: link(
                                        'm',
                                        match.id,
                                        keys.inviteToken,
                                      ),
                                    },
                                    {
                                      label: t(
                                        'Код приглашения',
                                        'Invitation code',
                                      ),
                                      url: keys.inviteToken,
                                    },
                                  ]
                                : []),
                              {
                                label: t('Наблюдатель', 'Spectator'),
                                url: link('m', match.id, keys.viewToken),
                              },
                            ]);
                            setNotice(
                              t(
                                'Ссылки обновлены. Предыдущие ссылки отозваны.',
                                'Links rotated. Previous links revoked.',
                              ),
                            );
                          })
                        }
                      >
                        {t('Приглашения и доступ', 'Invites and access')}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => void clipboard(link('m', match.id, ''))}
                    >
                      <Copy size={16} />
                      {t('Ссылка участника', 'Participant link')}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        void run(async () => {
                          let events: unknown[] = [];
                          let after = 0;
                          for (;;) {
                            const page = await request<{ seq: number }[]>(
                              'match.history',
                              { id: match.id, after },
                            );
                            events = [...events, ...page];
                            if (page.length < 1000) break;
                            after = page.at(-1)!.seq;
                          }
                          download(`match-${match.id}.json`, {
                            format: 'calad-match-1',
                            match,
                            events,
                          });
                        })
                      }
                    >
                      <Download size={16} />
                      {t('Журнал JSON', 'Export log')}
                    </Button>
                  </div>
                )}
                {match.result && (
                  <div className="result">
                    <h3>{t('Итог партии', 'Match result')}</h3>
                    <p>{match.result}</p>
                  </div>
                )}
                <details className="event-log">
                  <summary>
                    {t('Последние события', 'Recent events')} ·{' '}
                    {match.events.length}
                  </summary>
                  {[...match.events].reverse().map((e) => (
                    <p key={e.seq}>
                      <span className="mono">#{e.seq}</span> ·{' '}
                      {match.players.find((p) => p.userId === e.actor)?.name ??
                        t('Игрок', 'Player')}{' '}
                      · {term(e.action, ui)} ·{' '}
                      {new Date(e.at).toLocaleTimeString(ui)}
                    </p>
                  ))}
                </details>
              </>
            ) : (
              <div className="empty">
                <Swords />
                <h3>{t('Готовы к партии?', 'Ready for a game?')}</h3>
                <p>
                  {t(
                    'Создайте матч из сохранённого ростера в билдере или введите код приглашения.',
                    'Create a match from a saved roster or enter an invitation code.',
                  )}
                </p>
              </div>
            )}
            <h2 className="history-title">
              {t('Текущие и прошлые партии', 'Current and past matches')}
            </h2>
            <div className="saved-grid">
              {boot.matches.map((m) => (
                <article className="saved-card" key={m.id}>
                  <span className="status-pill">{term(m.status, ui)}</span>
                  <h3>{m.players.map((p) => p.rosterName).join(' × ')}</h3>
                  <p>{m.players.map((p) => p.name).join(' / ')}</p>
                  <p>{m.result}</p>
                  <small>{new Date(m.updatedAt).toLocaleString(ui)}</small>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void run(() => openMatch(m.id))}
                  >
                    {t('Открыть матч', 'Open match')}
                    <ArrowRight size={16} />
                  </Button>
                </article>
              ))}
            </div>
          </section>
        )}
        <section className="print-sheet">
          <header>
            <p>CALAD GUILD · ELDFALL CHRONICLES</p>
            <h1>{r.name}</h1>
            <p>
              {name(r.factionId, r.factionId, lang)} · {points}/{r.pointsLimit}{' '}
              RP · {r.entries.length} {t('моделей', 'models')}
            </p>
            <small>
              {t('Правила', 'Rules')} {term(r.rulesVersion, ui)} ·{' '}
              {t('Данные', 'Data')} {r.dataVersion}
            </small>
          </header>
          {r.entries.map((e, i) => {
            const c = d.characters.find((c) => c.id === e.characterId);
            if (!c) return null;
            return (
              <article key={e.id}>
                <h2>
                  {i + 1}. {name(c.id, c.name, lang)}{' '}
                  {r.leaderId === e.id ? t('★ Лидер', '★ Leader') : ''} ·{' '}
                  {c.cost} RP
                </h2>
                <Stats character={upgraded(c, e, d)} lang={ui} />
                {e.element && (
                  <p>
                    {t('Стихия', 'Element')}: {term(e.element, lang)}
                  </p>
                )}
                <p>
                  {c.classes.map((id) => term(id, lang)).join(' / ')} ·{' '}
                  {t('Инвентарь', 'Inventory')}:{' '}
                  {c.items
                    .map((i) => `${term(i.itemId, lang)} ×${i.quantity}`)
                    .join(', ') || '—'}
                </p>
                {e.upgrades.map((u, j) => (
                  <p key={j}>
                    +{' '}
                    {upgradeName(
                      upgrades.find((x) => x.id === u.id) ?? {
                        id: u.id,
                        name: u.id,
                      },
                      lang,
                    )}{' '}
                    {term(u.choice, lang)} · {upgradeCost(u.id, c, e, r, d)} RP
                  </p>
                ))}
                {e.spells.map((id) => {
                  const s = d.schools
                    .flatMap((s) => s.spells)
                    .find((s) => s.id === id);
                  return (
                    <p key={id}>
                      {s ? `${ruleName(s, lang)}: ${ruleText(s, lang)}` : id}
                    </p>
                  );
                })}
                <p>{e.notes}</p>
              </article>
            );
          })}
          <p>{r.notes}</p>
          <p>
            {t('Источник профилей', 'Profile source')}:
            guildhall.eldfall-chronicles.com ·{' '}
            {t('Карточки улучшений', 'Upgrade cards')} v1.6
          </p>
        </section>
      </main>
      <footer className="no-print">
        <span>
          CALAD GUILD /{' '}
          {t(
            'Личный, неофициальный инструмент',
            'Private, unofficial companion',
          )}
        </span>
        <span>
          {d.characters.length} {t('профилей', 'profiles')} · {d.date} ·{' '}
          <a href={d.sourceUrl} target="_blank" rel="noreferrer">
            Guild Hall ↗
          </a>
        </span>
      </footer>
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void run(() => importFile(file));
          e.target.value = '';
        }}
      />
      <Profile
        c={profile?.c ?? null}
        d={profile?.d ?? d}
        lang={lang}
        ui={ui}
        close={() => setProfile(null)}
      />
    </div>
  );
}
