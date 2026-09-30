import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { IconField } from '@/components/IconField'
import { MediaInput } from '@/components/MediaInput'
import { Select } from '@/components/Select'
import { Disclosure, SectionHead } from '@/components/ui'
import { type WidgetConfig } from '@/lib/api'
import { BILINGUAL_PATHS } from '@/lib/builder'
import {
  HERO_DECORS, HERO_DECOR_MOTIONS, HERO_DRIFTS, HERO_ENTRANCES, HERO_LAYOUTS,
  HERO_PATTERNS, HERO_PRESETS, HERO_PRESET_IDS, normalizeHeroSlide,
} from '@/lib/heroDesign'
import { useI18n } from '@/lib/i18n'
import {
  BilingualField, BrandColorField, ChoiceField, ColorField, Field, NumField, ToggleField, type PageProps,
} from './fields'

export function HeaderPage({ get, set, disabled }: PageProps) {
  const { t } = useI18n()
  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('form.header')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('form.headerTitle')} path="widget_v2_config.header.content.title" get={get} set={set} disabled={disabled} />
          <Field label={t('form.headerSubtitle')} path="widget_v2_config.header.content.subtitle" get={get} set={set} disabled={disabled} />
          <ColorField label={t('form.headerBg')} path="widget_v2_config.header.background.color" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.header.titleColor')} path="widget_v2_config.header.titleStyle.color" get={get} set={set} disabled={disabled} />
          <div className="grid content-end gap-2">
            <ToggleField label={t('form.headerShow')} path="widget_v2_config.header.enabled" get={get} set={set} disabled={disabled} />
            <ToggleField label={t('form.headerBgOn')} path="widget_v2_config.header.background.enabled" get={get} set={set} disabled={disabled} />
          </div>
        </div>
      </section>
      <section>
        <SectionHead>{t('builder.header.controls')}</SectionHead>
        <p className="callout mb-4">{t('builder.header.controlsHint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.header.langToggle')} path="widget_v2_config.header.controls.lang.show" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.header.resetBtn')} path="widget_v2_config.header.actions.reset" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.header.themeToggle')} path="widget_v2_config.header.controls.theme.show" get={get} set={set} disabled={disabled} />
          {get('widget_v2_config.header.controls.lang.show') !== false && (
            <IconField
              label={t('builder.header.langIcon')} set="lang"
              value={get('widget_v2_config.header.controls.lang.icon')} url={get('widget_v2_config.header.controls.lang.iconUrl')}
              onChange={(v) => set('widget_v2_config.header.controls.lang.icon', v)} onUrlChange={(v) => set('widget_v2_config.header.controls.lang.iconUrl', v)}
              disabled={disabled}
            />
          )}
          {get('widget_v2_config.header.controls.theme.show') !== false && (
            <IconField
              label={t('builder.header.themeIcon')} set="theme"
              value={get('widget_v2_config.header.controls.theme.icon')} url={get('widget_v2_config.header.controls.theme.iconUrl')}
              onChange={(v) => set('widget_v2_config.header.controls.theme.icon', v)} onUrlChange={(v) => set('widget_v2_config.header.controls.theme.iconUrl', v)}
              disabled={disabled}
            />
          )}
        </div>
      </section>
      <section>
        <SectionHead>{t('form.avatar')}</SectionHead>
        <MediaInput label={t('form.avatar')} value={get('avatar_url') ?? ''} onChange={(v) => set('avatar_url', v)} disabled={disabled} />
      </section>
    </div>
  )
}

/* ------------------------------------ hero ---------------------------------- */

const HERO = 'widget_v2_config.intro_screen.heroSection'
const HERO_IMAGES = `${HERO}.heroImages`
const HERO_SINGLE = `${HERO}.heroImage.url`
const HERO_CAROUSEL = `${HERO}.carousel`

/** A hero slide as stored in the config: an uploaded image, or an editable design. */
type StoredSlide = { type?: 'image' | 'design'; url?: string; design?: unknown; style?: string }

export function HeroPage({ draft, setDraft, get, set, disabled }: { draft: WidgetConfig; setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void } & PageProps) {
  const { t } = useI18n()
  const raw = get(HERO_IMAGES)
  const stored: StoredSlide[] = Array.isArray(raw) && raw.length ? raw : [{ type: 'image', url: get(HERO_SINGLE) ?? '' }]
  const slides = stored.map((s) => normalizeHeroSlide(s))

  const write = (next: StoredSlide[]) => {
    set(HERO_IMAGES, next)
    // The SDK's legacy single-hero field still has to point at something drawable.
    set(HERO_SINGLE, next.find((s) => s.type !== 'design' && s.url?.trim())?.url ?? '')
  }
  const patch = (i: number, p: StoredSlide) => write(stored.map((s, j) => (j === i ? { ...s, ...p } : s)))
  const move = (i: number, dir: -1 | 1) => {
    const next = [...stored]
    const [s] = next.splice(i, 1)
    next.splice(i + dir, 0, s)
    write(next)
  }
  /** Switching to a design writes a whole one, so every field below has a real value to show. */
  const setType = (i: number, v: string) =>
    write(stored.map((s, j) => (j !== i ? s : v === 'design' ? { type: 'design', design: HERO_PRESETS['cinescape-night'].design } : { type: 'image', url: s.url ?? '' })))

  const filled = slides.filter((s) => s !== null).length

  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('form.intro')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <BilingualField label={t('form.welcomeTitle')} path={BILINGUAL_PATHS[0]} draft={draft} setDraft={setDraft} disabled={disabled} />
          <BilingualField label={t('form.welcomeSubtitle')} path={BILINGUAL_PATHS[1]} draft={draft} setDraft={setDraft} disabled={disabled} />
          <ToggleField label={t('form.heroShow')} path={`${HERO}.enabled.value`} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('form.introShow')} path="widget_v2_config.intro_screen.showIntroScreen.value" get={get} set={set} disabled={disabled} />
        </div>
      </section>

      <CarouselSection get={get} set={set} disabled={disabled} />

      <section>
        <SectionHead
          aside={
            !disabled && (
              <div className="-my-1 flex items-center gap-1">
                <button className="btn-quiet btn-sm normal-case" onClick={() => write([...stored, { type: 'image', url: '' }])}>
                  <Plus className="size-3.5" />
                  {t('builder.hero.add')}
                </button>
                <button className="btn-quiet btn-sm normal-case" onClick={() => write([...stored, { type: 'design', design: HERO_PRESETS['cinescape-night'].design }])}>
                  <Plus className="size-3.5" />
                  {t('builder.hero.addDesign')}
                </button>
              </div>
            )
          }
        >
          {t('builder.hero.list', { count: filled })}
        </SectionHead>
        <p className="callout mb-3">{t('builder.hero.hint')}</p>
        <ul className="space-y-3">
          {stored.map((s, i) => (
            <li key={i} className="row-in rounded-xl border border-line bg-surface/40 p-3.5" style={{ '--d': i } as React.CSSProperties}>
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <span className="eyebrow">{t('builder.hero.slide', { n: i + 1 })}</span>
                <div className="flex items-center gap-1">
                  <button className="btn-ghost btn-sm" onClick={() => move(i, -1)} disabled={disabled || i === 0} title={t('builder.moveUp')} aria-label={t('builder.moveUp')}><ArrowUp className="size-3.5" /></button>
                  <button className="btn-ghost btn-sm" onClick={() => move(i, 1)} disabled={disabled || i === stored.length - 1} title={t('builder.moveDown')} aria-label={t('builder.moveDown')}><ArrowDown className="size-3.5" /></button>
                  <button className="btn-danger btn-sm" onClick={() => write(stored.filter((_, j) => j !== i))} disabled={disabled || stored.length === 1} title={t('common.delete')} aria-label={t('common.delete')}><Trash2 className="size-3.5" /></button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">{t('builder.hero.type')}</label>
                  <Select
                    label={t('builder.hero.type')}
                    value={s.type === 'design' || s.design ? 'design' : 'image'}
                    onChange={(v) => setType(i, v)}
                    disabled={disabled}
                    options={[
                      { value: 'image', label: t('builder.hero.type.image') },
                      { value: 'design', label: t('builder.hero.type.design') },
                    ]}
                  />
                </div>
                {s.type === 'design' || s.design ? (
                  <div className="sm:col-span-2">
                    <DesignEditor base={`${HERO_IMAGES}.${i}.design`} onPreset={(id) => patch(i, { type: 'design', design: HERO_PRESETS[id].design })} get={get} set={set} disabled={disabled} />
                  </div>
                ) : (
                  <div className="sm:col-span-2">
                    <MediaInput label={t('builder.hero.image', { n: i + 1 })} value={s.url ?? ''} onChange={(v) => patch(i, { type: 'image', url: v })} disabled={disabled} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/** How long a slide is held, how slides change, and how the dots look. */
function CarouselSection({ get, set, disabled }: PageProps) {
  const { t } = useI18n()
  const p = (k: string) => `${HERO_CAROUSEL}.${k}`
  const d = (k: string) => `${HERO_CAROUSEL}.dots.${k}`
  return (
    <section>
      <SectionHead>{t('builder.hero.carousel')}</SectionHead>
      <p className="callout mb-3">{t('builder.hero.carouselHint')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ToggleField label={t('builder.hero.autoplay')} path={p('autoplay')} get={get} set={set} disabled={disabled} />
        <ChoiceField label={t('builder.hero.transition')} path={p('transition')} options={['fade', 'slide']} keyPrefix="builder.hero.transition" fallback="fade" get={get} set={set} disabled={disabled} />
        <NumField label={t('builder.hero.interval')} path={p('intervalMs')} min={800} max={15000} step={100} fallback={3500} unit="ms" get={get} set={set} disabled={disabled} />
      </div>

      <p className="eyebrow mt-5 mb-2">{t('builder.hero.dots')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ToggleField label={t('builder.hero.dots.show')} path={d('show')} get={get} set={set} disabled={disabled} />
        <ChoiceField label={t('builder.hero.dots.shape')} path={d('shape')} options={['pill', 'dot', 'bar']} keyPrefix="builder.hero.dots.shape" fallback="pill" get={get} set={set} disabled={disabled} />
        <ChoiceField label={t('builder.hero.dots.position')} path={d('position')} options={['below', 'overlay']} keyPrefix="builder.hero.dots.position" fallback="below" get={get} set={set} disabled={disabled} />
        <NumField label={t('builder.hero.dots.size')} path={d('size')} min={2} max={20} step={1} fallback={5} unit="px" get={get} set={set} disabled={disabled} />
        <NumField label={t('builder.hero.dots.activeWidth')} path={d('activeWidth')} min={2} max={60} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
        <NumField label={t('builder.hero.dots.gap')} path={d('gap')} min={0} max={24} step={1} fallback={6} unit="px" get={get} set={set} disabled={disabled} />
        <BrandColorField label={t('builder.hero.dots.activeColor')} path={d('activeColor')} get={get} set={set} disabled={disabled} />
        <BrandColorField label={t('builder.hero.dots.inactiveColor')} path={d('inactiveColor')} get={get} set={set} disabled={disabled} />
        <NumField label={t('builder.hero.dots.inactiveOpacity')} path={d('inactiveOpacity')} min={0} max={1} step={0.05} fallback={0.35} get={get} set={set} disabled={disabled} />
      </div>
    </section>
  )
}

/** Every value of one designed slide. Grouped, because there are a lot of them. */
function DesignEditor({ base, onPreset, get, set, disabled }: { base: string; onPreset: (id: string) => void } & PageProps) {
  const { t } = useI18n()
  const p = (k: string) => `${base}.${k}`
  const gradient = get(p('background.type')) === 'gradient'
  const patterned = (get(p('pattern.asset')) ?? 'none') !== 'none'
  const shape = get(p('decor.shape')) ?? 'none'
  const decorated = shape !== 'none'

  return (
    <div className="space-y-2.5">
      <div>
        <label className="label">{t('builder.hero.preset')}</label>
        <div className="flex flex-wrap gap-1.5">
          {HERO_PRESET_IDS.map((id) => (
            <button key={id} className="btn-ghost btn-sm normal-case" onClick={() => onPreset(id)} disabled={disabled}>
              {HERO_PRESETS[id].label}
            </button>
          ))}
        </div>
        <p className="fine mt-1.5">{t('builder.hero.presetHint')}</p>
      </div>

      <Disclosure summary={t('builder.hero.bg')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.hero.bg.type')} path={p('background.type')} options={['color', 'gradient']} keyPrefix="builder.hero.bg.type" fallback="color" get={get} set={set} disabled={disabled} />
          {gradient ? (
            <>
              <NumField label={t('builder.hero.bg.angle')} path={p('background.angle')} min={0} max={360} step={5} fallback={135} unit="°" get={get} set={set} disabled={disabled} />
              <ColorField label={t('builder.hero.bg.from')} path={p('background.from')} get={get} set={set} disabled={disabled} />
              <ColorField label={t('builder.hero.bg.to')} path={p('background.to')} get={get} set={set} disabled={disabled} />
            </>
          ) : (
            <ColorField label={t('builder.hero.bg.color')} path={p('background.color')} get={get} set={set} disabled={disabled} />
          )}
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.hero.pattern')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.hero.pattern.asset')} path={p('pattern.asset')} options={[...HERO_PATTERNS]} keyPrefix="builder.hero.pattern.asset" fallback="none" get={get} set={set} disabled={disabled} />
          {patterned && (
            <>
              <ColorField label={t('builder.hero.pattern.color')} path={p('pattern.color')} get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.hero.pattern.opacity')} path={p('pattern.opacity')} min={0} max={1} step={0.01} fallback={0.9} get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.hero.pattern.scale')} path={p('pattern.scale')} min={0.25} max={4} step={0.05} fallback={1} unit="×" get={get} set={set} disabled={disabled} />
              <ChoiceField label={t('builder.hero.pattern.target')} path={p('pattern.target')} options={['background', 'decor']} keyPrefix="builder.hero.pattern.target" fallback="background" get={get} set={set} disabled={disabled} />
              <ToggleField label={t('builder.hero.pattern.fade')} path={p('pattern.fade')} get={get} set={set} disabled={disabled} />
            </>
          )}
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.hero.decor')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.hero.decor.shape')} path={p('decor.shape')} options={[...HERO_DECORS]} keyPrefix="builder.hero.decor.shape" fallback="none" get={get} set={set} disabled={disabled} />
          {decorated && (
            <>
              <NumField label={t('builder.hero.decor.opacity')} path={p('decor.opacity')} min={0} max={1} step={0.05} fallback={1} get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.hero.decor.x')} path={p('decor.x')} min={-200} max={400} step={1} fallback={192} get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.hero.decor.y')} path={p('decor.y')} min={-200} max={300} step={1} fallback={24} get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.hero.decor.w')} path={p('decor.w')} min={8} max={600} step={1} fallback={200} get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.hero.decor.h')} path={p('decor.h')} min={8} max={500} step={1} fallback={173} get={get} set={set} disabled={disabled} />
              <ColorField label={t('builder.hero.decor.color')} path={p('decor.color')} get={get} set={set} disabled={disabled} />
              {(shape === 'chevron-pair' || shape === 'triple-chevron') && (
                <ColorField label={t('builder.hero.decor.color2')} path={p('decor.color2')} get={get} set={set} disabled={disabled} />
              )}
              {shape === 'wedge' && (
                <NumField label={t('builder.hero.decor.point')} path={p('decor.point')} min={0.02} max={1} step={0.01} fallback={0.32} get={get} set={set} disabled={disabled} />
              )}
              <ColorField label={t('builder.hero.decor.fill')} path={p('decor.fill')} get={get} set={set} disabled={disabled} />
            </>
          )}
        </div>
        <p className="fine mt-2">{t('builder.hero.decor.hint')}</p>
      </Disclosure>

      <Disclosure summary={t('builder.hero.copy')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.hero.layout')} path={p('layout')} options={[...HERO_LAYOUTS]} keyPrefix="builder.hero.layout" fallback="text-left" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.hero.mirror')} path={p('mirrorInRtl')} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.hero.mirrorShape')} path={p('decor.mirrorShape')} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.hero.badge.show')} path={p('badge.show')} get={get} set={set} disabled={disabled} />
          <Field label={t('builder.hero.badge.text')} path={p('badge.text')} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.hero.badge.logo')} path={p('badge.showLogo')} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.hero.badge.color')} path={p('badge.color')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.hero.badge.size')} path={p('badge.size')} min={6} max={28} step={0.5} fallback={11} unit="px" get={get} set={set} disabled={disabled} />

          <ToggleField label={t('builder.hero.title.show')} path={p('title.show')} get={get} set={set} disabled={disabled} />
          <Field label={t('builder.hero.title.text')} path={p('title.text')} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.hero.title.color')} path={p('title.color')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.hero.title.size')} path={p('title.size')} min={8} max={48} step={0.5} fallback={24} unit="px" get={get} set={set} disabled={disabled} />

          <ToggleField label={t('builder.hero.subtitle.show')} path={p('subtitle.show')} get={get} set={set} disabled={disabled} />
          <Field label={t('builder.hero.subtitle.text')} path={p('subtitle.text')} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.hero.subtitle.color')} path={p('subtitle.color')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.hero.subtitle.size')} path={p('subtitle.size')} min={6} max={32} step={0.5} fallback={13} unit="px" get={get} set={set} disabled={disabled} />
        </div>
        <p className="fine mt-2">{t('builder.hero.copyHint')}</p>
      </Disclosure>

      <Disclosure summary={t('builder.hero.motion')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.hero.motion.entrance')} path={p('motion.entrance')} options={[...HERO_ENTRANCES]} keyPrefix="builder.hero.motion.entrance" fallback="rise" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.hero.motion.entranceMs')} path={p('motion.entranceMs')} min={0} max={3000} step={50} fallback={600} unit="ms" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.hero.motion.decor')} path={p('motion.decor')} options={[...HERO_DECOR_MOTIONS]} keyPrefix="builder.hero.motion.decor" fallback="slide" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.hero.motion.decorMs')} path={p('motion.decorMs')} min={0} max={3000} step={50} fallback={700} unit="ms" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.hero.motion.drift')} path={p('motion.drift')} options={[...HERO_DRIFTS]} keyPrefix="builder.hero.motion.drift" fallback="none" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.hero.motion.driftMs')} path={p('motion.driftMs')} min={2000} max={120000} step={500} fallback={40000} unit="ms" get={get} set={set} disabled={disabled} />
        </div>
        <p className="fine mt-2">{t('builder.hero.motionHint')}</p>
      </Disclosure>
    </div>
  )
}
