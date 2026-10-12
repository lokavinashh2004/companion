// Small games for a low moment, in Mood & symptoms: guided breathing, bubble pop, memory match and kind words.
// Each opens in a sheet and ends with "How do you feel now?", which logs a mood so she can see what helps.
// Nothing here is stored except that optional mood.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { MOOD_EMOJI } from '@/components/today/constants';
import { Button, Card, cx, Muted, Notice, Sheet } from '@/components/ui';
import { useQuickLog } from '@/lib/queries';
import s from './games.module.css';

type Game = 'breathe' | 'bubbles' | 'memory' | 'words';
const GAMES: { key: Game; icon: string }[] = [
  { key: 'breathe', icon: '🫧' },
  { key: 'bubbles', icon: '🎈' },
  { key: 'memory', icon: '🃏' },
  { key: 'words', icon: '💌' },
];

export function MoodGames({ day, random = Math.random }: { day: string; random?: () => number }) {
  const { t } = useTranslation();
  const [game, setGame] = useState<Game | null>(null);
  return (
    <Card title={t('games.title')} icon="🎮" tint="violet">
      <Muted small>{t('games.intro')}</Muted>
      <ul className={s.picker}>
        {GAMES.map((g) => (
          <li key={g.key}>
            <button type="button" className={s.pick} onClick={() => setGame(g.key)}>
              <span className={s.pickIcon} aria-hidden="true">
                {g.icon}
              </span>
              <span className={s.pickTitle}>{t(`games.${g.key}.title`)}</span>
              <span className={s.pickBody}>{t(`games.${g.key}.body`)}</span>
            </button>
          </li>
        ))}
      </ul>
      <Sheet open={!!game} onClose={() => setGame(null)} title={game ? t(`games.${game}.title`) : ''}>
        {game ? (
          <div className={s.play}>
            {game === 'breathe' ? <Breathing /> : null}
            {game === 'bubbles' ? <BubblePop random={random} /> : null}
            {game === 'memory' ? <MemoryMatch random={random} /> : null}
            {game === 'words' ? <KindWords random={random} /> : null}
            <FeelNow day={day} />
          </div>
        ) : null}
      </Sheet>
    </Card>
  );
}

// ---------------------------------------------------------------- box breathing: in 4, hold 4, out 4, hold 4

const PHASES = ['in', 'hold', 'out', 'rest'] as const;
const PHASE_S = 4;
const ROUNDS = 4;

export function Breathing() {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0); // seconds since start
  const total = ROUNDS * PHASES.length * PHASE_S;
  const done = tick >= total;
  useEffect(() => {
    if (!running || done) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running, done]);
  const phase = PHASES[Math.floor(tick / PHASE_S) % PHASES.length]!;
  const left = PHASE_S - (tick % PHASE_S);
  const round = Math.min(ROUNDS, Math.floor(tick / (PHASES.length * PHASE_S)) + 1);
  // Big while breathing in and holding; small while breathing out and resting.
  const big = running && !done && (phase === 'in' || phase === 'hold');
  return (
    <>
      <div className={s.breathStage}>
        <div className={s.breathCircle} style={{ transform: `scale(${big ? 1 : 0.55})` }} aria-hidden="true" />
        <p className={s.breathText} aria-live="polite">
          {done ? t('games.breathe.done') : running ? t(`games.breathe.${phase}`) : t('games.breathe.ready')}
          {running && !done ? <span className={s.breathCount}>{left}</span> : null}
        </p>
      </div>
      {running && !done ? <p className={s.score}>{t('games.breathe.round', { round, total: ROUNDS })}</p> : null}
      <Button
        kind={running && !done ? 'secondary' : 'primary'}
        onClick={() => {
          if (running && !done) return setRunning(false);
          setTick(0);
          setRunning(true);
        }}
      >
        {running && !done ? t('games.stop') : done ? t('games.again') : t('games.start')}
      </Button>
    </>
  );
}

// ---------------------------------------------------------------- bubble pop

const BUBBLES = 12;
const hue = (random: () => number) => Math.floor(random() * 360);

export function BubblePop({ random }: { random: () => number }) {
  const { t } = useTranslation();
  const [hues, setHues] = useState(() => Array.from({ length: BUBBLES }, () => hue(random)));
  const [popped, setPopped] = useState<Set<number>>(new Set());
  const [count, setCount] = useState(0);
  const pop = (i: number) => {
    if (popped.has(i)) return;
    navigator.vibrate?.(12);
    setCount((n) => n + 1);
    setPopped((p) => new Set(p).add(i));
    // A fresh bubble grows back in the same spot.
    setTimeout(() => {
      setHues((h) => h.map((x, j) => (j === i ? hue(random) : x)));
      setPopped((p) => {
        const next = new Set(p);
        next.delete(i);
        return next;
      });
    }, 650);
  };
  return (
    <>
      <p className={s.score} aria-live="polite">
        {t('games.bubbles.count', { count })}
      </p>
      <div className={s.bubbles}>
        {hues.map((h, i) => (
          <button
            key={i}
            type="button"
            className={cx(s.bubble, popped.has(i) && s.popped)}
            style={{ '--h': h } as CSSProperties}
            aria-label={t('games.bubbles.pop', { n: i + 1 })}
            onClick={() => pop(i)}
          />
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- memory match

const FACES = ['🌸', '🌙', '🍓', '🦋', '☀️', '🌈'];

function shuffle<T>(xs: T[], random: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function MemoryMatch({ random }: { random: () => number }) {
  const { t } = useTranslation();
  const deal = () => shuffle([...FACES, ...FACES], random);
  const [cards, setCards] = useState(deal);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const won = matched.size === FACES.length;

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(hideTimer.current ?? undefined), []);

  const flip = (i: number) => {
    if (open.length === 2 || open.includes(i) || matched.has(cards[i]!)) return;
    if (open.length === 0) return setOpen([i]);
    // Second card of a turn: keep a pair, or show both briefly and turn them back over.
    const first = open[0]!;
    setMoves((n) => n + 1);
    if (cards[first] === cards[i]) {
      setMatched((m) => new Set(m).add(cards[i]!));
      setOpen([]);
    } else {
      setOpen([first, i]);
      hideTimer.current = setTimeout(() => setOpen([]), 800);
    }
  };
  return (
    <>
      <p className={s.score} aria-live="polite">
        {won ? t('games.memory.won', { moves }) : t('games.memory.status', { pairs: matched.size, total: FACES.length, moves })}
      </p>
      <div className={s.cards}>
        {cards.map((face, i) => {
          const isMatched = matched.has(face);
          const up = isMatched || open.includes(i);
          return (
            <button
              key={i}
              type="button"
              className={cx(s.card, up && s.faceUp, isMatched && s.matched)}
              aria-label={up ? face : t('games.memory.hidden', { n: i + 1 })}
              aria-pressed={up}
              onClick={() => flip(i)}
            >
              {up ? face : ''}
            </button>
          );
        })}
      </div>
      {won ? (
        <Button
          onClick={() => {
            setCards(deal());
            setMatched(new Set());
            setOpen([]);
            setMoves(0);
          }}
        >
          {t('games.again')}
        </Button>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------- kind words

const WORDS = 10;

export function KindWords({ random }: { random: () => number }) {
  const { t } = useTranslation();
  const [i, setI] = useState(() => Math.floor(random() * WORDS));
  return (
    <>
      <blockquote className={s.quote} aria-live="polite">
        {t(`games.words.list.${i}`)}
      </blockquote>
      <Button kind="secondary" onClick={() => setI((n) => (n + 1 + Math.floor(random() * (WORDS - 1))) % WORDS)}>
        {t('games.words.next')}
      </Button>
    </>
  );
}

// ---------------------------------------------------------------- after a game

function FeelNow({ day }: { day: string }) {
  const { t } = useTranslation();
  const log = useQuickLog();
  if (log.isSuccess) return <Notice>{t('games.thanks')}</Notice>;
  return (
    <div className={s.after}>
      <Muted small>{t('games.feelNow')}</Muted>
      <div className={s.faces} role="group" aria-label={t('games.feelNow')}>
        {MOOD_EMOJI.map((emoji, idx) => (
          <button key={emoji} type="button" className={s.face} aria-label={t('todayPage.logMood', { value: idx + 1 })} disabled={log.isPending} onClick={() => log.mutate({ day, mood: idx + 1 })}>
            <span aria-hidden="true">{emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
