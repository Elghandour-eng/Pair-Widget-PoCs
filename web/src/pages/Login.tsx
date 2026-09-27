import { ArrowRight, ExternalLink } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { LangSwitch, PairMark, PairWordmark, PasswordInput, Spinner } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { useI18n, type MsgKey } from '@/lib/i18n'

export const PAIR_SITE = 'https://trypair.ai'

export function Login() {
  const { user, login } = useAuth()
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to="/widgets" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try { await login(email, password) } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="grid h-dvh overflow-hidden lg:grid-cols-[1.05fr_minmax(0,0.95fr)]">
      {/* Brand canvas — the spec's cover gradients and diagram shapes */}
      <aside className="relative hidden overflow-hidden border-e border-line bg-white lg:block">
        <Glow />
        <div className="relative grid h-full grid-rows-[auto_1fr] gap-8 overflow-hidden p-10 xl:p-14">
          <div className="anim-rise self-start">
            <PairWordmark className="h-8 text-accent" />
            <p className="mt-2.5 text-[11px] font-bold uppercase tracking-[0.09em] text-accent-deep">{t('app.product')}</p>
          </div>

          <div className="anim-rise min-h-0 self-center" style={{ animationDelay: '90ms' }}>
            <h2 className="max-w-[18em] text-[30px] font-extrabold leading-[1.12] tracking-[-0.02em] text-ink xl:text-[38px]">
              {t('hero.title')}
            </h2>
            <p className="mt-4 max-w-[30em] text-[13.5px] leading-[1.6] text-muted">{t('hero.body')}</p>
            <Showcase />
          </div>

        </div>
      </aside>

      {/* Form */}
      <main className="scroll-pane relative flex items-center justify-center p-5 sm:p-8">
        <Glow className="lg:hidden" />
        <div className="absolute inset-x-4 top-4 z-10 flex items-center justify-between gap-3 sm:inset-x-6 sm:top-5">
          <a
            href={PAIR_SITE}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-muted transition-colors duration-200 hover:text-accent-deep"
          >
            trypair.ai
            <ExternalLink className="size-3.5" />
          </a>
          <LangSwitch compact />
        </div>

        <div className="anim-rise relative w-full max-w-[23rem]">
          <div className="mb-7 text-center lg:hidden">
            <PairWordmark className="mx-auto h-8 text-accent" />
            <p className="mt-2.5 text-[11px] font-bold uppercase tracking-[0.09em] text-muted">{t('app.product')}</p>
          </div>

          <div className="mb-6 hidden items-center gap-2.5 lg:flex">
            <PairMark className="h-6 text-accent" />
            <div>
              <h1 className="text-[19px] font-extrabold leading-tight text-ink">{t('login.heading')}</h1>
              <p className="text-[12px] text-muted">{t('login.sub')}</p>
            </div>
          </div>

          <form onSubmit={submit} className="card raise space-y-4 p-5 sm:p-6">
            <div className="stagger space-y-4">
              <div style={{ '--d': 0 } as React.CSSProperties}>
                <label className="label" htmlFor="email">{t('login.email')}</label>
                <input id="email" className="input mono" type="email" autoComplete="username" dir="ltr" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </div>
              <div style={{ '--d': 1 } as React.CSSProperties}>
                <PasswordInput label={t('login.password')} value={password} onChange={setPassword} placeholder="••••••••" />
              </div>
            </div>

            {error && (
              <p key={error} className="anim-shake border-s-[3px] border-alert bg-alert-soft px-3 py-2 text-[12.5px] font-semibold text-alert" role="alert">
                {error}
              </p>
            )}

            <button className="btn-primary sheen w-full" disabled={busy}>
              {busy ? (
                <Spinner className="size-4 border-white/40 border-t-white" />
              ) : (
                <>
                  {t('login.submit')}
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100" />
                </>
              )}
            </button>
          </form>

        </div>
      </main>
    </div>
  )
}

/** The cover gradients from the Pair spec — two radial stops on white — slowly drifting. */
function Glow({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div
        className="anim-drift absolute -end-[18%] -top-[22%] size-[62%] rounded-full blur-[2px]"
        style={{ background: 'radial-gradient(circle, rgba(164,220,255,0.45) 0%, rgba(164,220,255,0.18) 45%, transparent 78%)' }}
      />
      <div
        className="anim-drift absolute -bottom-[26%] -start-[14%] size-[58%] rounded-full blur-[2px]"
        style={{ background: 'radial-gradient(circle, rgba(177,226,255,0.34) 0%, rgba(177,226,255,0.15) 40%, transparent 76%)', animationDelay: '-8s' }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Showcase — four miniatures of the studio, cycling on their own.
 * ------------------------------------------------------------------ */

const SCREENS = ['design', 'preview', 'embed', 'compare'] as const
type Screen = (typeof SCREENS)[number]

function Showcase() {
  const { t } = useI18n()
  const [screen, setScreen] = useState<Screen>('design')
  const [leaving, setLeaving] = useState<Screen | null>(null)
  const [paused, setPaused] = useState(false)

  // Cross-fade: the outgoing screen stays mounted just long enough to fade out under the new one.
  const go = useCallback((next: Screen) => {
    setScreen((current) => {
      if (current === next) return current
      setLeaving(current)
      return next
    })
  }, [])

  useEffect(() => {
    if (!leaving) return
    const id = setTimeout(() => setLeaving(null), 400)
    return () => clearTimeout(id)
  }, [leaving])

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => go(SCREENS[(SCREENS.indexOf(screen) + 1) % SCREENS.length]), 5200)
    return () => clearInterval(id)
  }, [paused, screen, go])

  return (
    <div
      className="anim-rise mt-9 w-full max-w-[30rem]"
      style={{ animationDelay: '200ms' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="card raise overflow-hidden">
        <div className="flex items-center gap-1.5 border-b border-line bg-surface/70 px-3 py-2">
          <span className="size-2 rounded-full bg-line" />
          <span className="size-2 rounded-full bg-line" />
          <span className="size-2 rounded-full bg-line" />
          <span className="ms-2 text-[9.5px] font-bold uppercase tracking-[0.09em] text-faint">{t('app.product')}</span>
          <span className="ms-auto rounded-sm bg-accent-50 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.07em] text-accent">
            {t('hero.mock.live')}
          </span>
        </div>

        <div className="relative h-[228px]">
          {leaving && (
            <div key={`out-${leaving}`} className="screen-out absolute inset-0 p-4">
              <ScreenBody screen={leaving} />
            </div>
          )}
          <div key={`in-${screen}`} className="screen-in absolute inset-0 p-4">
            <ScreenBody screen={screen} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          {SCREENS.map((sc) => (
            <button
              key={sc}
              type="button"
              onClick={() => go(sc)}
              aria-label={t(`hero.screen.${sc}` as MsgKey)}
              aria-current={screen === sc}
              className={`relative h-1.5 overflow-hidden rounded-full transition-all duration-300 ease-out ${
                screen === sc ? 'w-8 bg-accent-200' : 'w-1.5 bg-line hover:bg-accent-300'
              }`}
            >
              {screen === sc && (
                <span
                  key={`${sc}-${paused}`}
                  className="absolute inset-0 origin-left rounded-full bg-accent"
                  style={paused ? { transform: 'scaleX(1)' } : { animation: 'tick 5.2s linear both' }}
                />
              )}
            </button>
          ))}
        </div>
        <span className="text-[10.5px] font-bold text-muted">{t(`hero.screen.${screen}` as MsgKey)}</span>
      </div>
    </div>
  )
}

function ScreenBody({ screen }: { screen: Screen }) {
  if (screen === 'design') return <DesignScreen />
  if (screen === 'preview') return <PreviewScreen />
  if (screen === 'embed') return <EmbedScreen />
  return <CompareScreen />
}

/** 1 — the design form driving a live phone preview. */
function DesignScreen() {
  const { t } = useI18n()
  return (
    <div className="grid h-full grid-cols-[1fr_106px] gap-4">
      <div className="min-w-0 space-y-2.5">
        <p className="rule-head pb-1 text-[8.5px]">{t('form.brand')}</p>
        <div>
          <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.09em] text-accent">{t('form.color')}</p>
          <div className="flex items-center gap-1.5">
            <span className="brand-cycle size-5 shrink-0 rounded-md" />
            <span className="mono flex h-6 flex-1 items-center rounded-md border border-line px-1.5 text-[8.5px] text-muted">
              #4D98E2<span className="caret ms-px">|</span>
            </span>
          </div>
        </div>
        <div>
          <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.09em] text-accent">{t('form.headerTitle')}</p>
          <span className="flex h-6 items-center rounded-md border border-line px-1.5 text-[8.5px] font-semibold text-body">
            {t('hero.mock.title')}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-md border border-line bg-surface/60 px-2 py-1.5">
          <span className="text-[8.5px] font-bold text-ink">{t('form.heroShow')}</span>
          <span className="brand-cycle flex h-3 w-6 items-center rounded-full px-px">
            <span className="ms-auto size-2.5 rounded-full bg-white" />
          </span>
        </div>
      </div>
      <Phone />
    </div>
  )
}

/** 2 — the preview on its own, light and dark. */
function PreviewScreen() {
  const { t } = useI18n()
  return (
    <div className="flex h-full items-stretch justify-center gap-5">
      <div className="flex flex-col items-center gap-2">
        <Phone />
        <span className="text-[8px] font-bold uppercase tracking-[0.09em] text-faint">{t('hero.preview.light')}</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Phone dark />
        <span className="text-[8px] font-bold uppercase tracking-[0.09em] text-faint">{t('hero.preview.dark')}</span>
      </div>
    </div>
  )
}

/** 3 — the install snippet. */
function EmbedScreen() {
  const { t } = useI18n()
  const lines: [string, string][] = [
    ['<script>', 'tag'],
    ['  window.PairAiWidgetSettings = {', 'plain'],
    ["    position: 'left',", 'str'],
    ["    launcherTitle: 'Chat with us!',", 'str'],
    ['  }', 'plain'],
    ['  PairAiWidgetSDK.run({', 'plain'],
    ["    widgetId: '01KV5D4WSM…',", 'str'],
    ['  })', 'plain'],
    ['<\/script>', 'tag'],
  ]
  const tone: Record<string, string> = { tag: 'text-accent-deep', str: 'text-accent', plain: 'text-muted' }
  return (
    <div className="flex h-full flex-col">
      <p className="rule-head mb-2.5 pb-1 text-[8.5px]">{t('embed.snippet')}</p>
      <pre className="code-block flex-1 overflow-hidden p-2.5 text-[8.5px] leading-[1.55]" dir="ltr">
        {lines.map(([line, kind], i) => (
          <div key={i} className="chip-in whitespace-pre" style={{ '--d': i * 0.45 } as React.CSSProperties}>
            <span className={tone[kind]}>{line}</span>
          </div>
        ))}
      </pre>
      <div className="mt-2.5 flex gap-1.5">
        <span className="rounded-sm border border-line bg-white px-2 py-1 text-[8px] font-bold text-muted">{t('embed.copy')}</span>
        <span className="rounded-sm border border-line bg-white px-2 py-1 text-[8px] font-bold text-muted">CodePen</span>
      </div>
    </div>
  )
}

/** 4 — the live-vs-studio diff. */
function CompareScreen() {
  const { t } = useI18n()
  const rows = [
    ['widget_color', '#1A6DE5', '#4D98E2'],
    ['header.content.title', '∅', 'Hi, I’m Hiro'],
    ['intro_screen.heroSection', 'false', 'true'],
    ['chat_input.inputLayout', 'full_width_bar', 'floating_pill'],
  ]
  return (
    <div className="flex h-full flex-col">
      <p className="rule-head mb-2.5 pb-1 text-[8.5px]">{t('detail.tab.compare')}</p>
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-x-2 border-b border-accent pb-1 text-[7.5px] font-bold uppercase tracking-[0.06em] text-accent">
        <span>{t('compare.col.path')}</span>
        <span>{t('compare.col.live')}</span>
        <span>{t('compare.col.redis')}</span>
      </div>
      {rows.map(([path, live, studio], i) => (
        <div
          key={path}
          className="chip-in mono grid grid-cols-[1.4fr_1fr_1fr] gap-x-2 border-b border-divider py-1.5 text-[8px]"
          style={{ '--d': i } as React.CSSProperties}
          dir="ltr"
        >
          <span className="truncate text-body">{path}</span>
          <span className="truncate text-faint">{live}</span>
          <span className="truncate font-bold text-accent-deep">{studio}</span>
        </div>
      ))}
    </div>
  )
}

/** The little phone used by the first two screens. */
function Phone({ dark }: { dark?: boolean }) {
  const { t } = useI18n()
  const line = dark ? 'bg-white/20' : 'bg-divider'
  return (
    <div className={`flex h-full w-[106px] flex-col overflow-hidden rounded-lg ring-[3px] ring-ink/85 ${dark ? 'bg-ink' : 'bg-white'}`}>
      <div className="flex items-center gap-1 px-1.5 py-1.5">
        <span className="brand-cycle size-3 rounded-full" />
        <span className={`h-1.5 flex-1 rounded-full ${line}`} />
      </div>
      <div className="brand-cycle mx-1.5 h-[46px] rounded-md" />
      <div className="space-y-1 px-1.5 pt-1.5">
        <span className={`block h-1.5 w-4/5 rounded-full ${line}`} />
        <span className={`block h-1.5 w-3/5 rounded-full ${line}`} />
      </div>
      <div className="mt-auto space-y-1 p-1.5">
        {[0, 1].map((i) => (
          <span
            key={i}
            className={`chip-in brand-cycle-text block truncate rounded-full border px-1.5 py-1 text-[6px] font-bold ${dark ? 'border-white/20' : 'border-line'}`}
            style={{ '--d': i + 1 } as React.CSSProperties}
          >
            ✳ {t('preview.tryAsking')}
          </span>
        ))}
        <span className={`flex items-center gap-1 rounded-full px-1.5 py-1 ${dark ? 'bg-white/10' : 'bg-code'}`}>
          <span className={`h-1 flex-1 rounded-full ${line}`} />
          <span className="brand-cycle size-3 rounded-full" />
        </span>
      </div>
    </div>
  )
}
