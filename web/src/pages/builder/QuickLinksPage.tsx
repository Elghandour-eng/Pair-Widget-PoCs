import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { MediaInput } from '@/components/MediaInput'
import { Disclosure, SectionHead } from '@/components/ui'
import { BORDER_STYLES, CARD_LAYOUTS, FONT_WEIGHTS, IMAGE_FITS, TEXT_ALIGNS } from '@/lib/inputDesign'
import { useI18n } from '@/lib/i18n'
import {
  BrandColorField, ChoiceField, Field, FontField, NumField, ShadowFields, ToggleField, type PageProps,
} from './fields'

interface QuickLinkCard { id?: string; title?: string; subtitle?: string; url?: string; active?: boolean; message?: string; order?: number }

const QUICKLINKS = 'widget_v2_config.quick_links.design'

export function QuickLinksPage({ get, set, disabled }: PageProps) {
  const { t } = useI18n()
  const q = (k: string) => `${QUICKLINKS}.${k}`
  const carousel = (get(q('layout')) ?? 'carousel') === 'carousel'
  const PATH = 'widget_v2_config.quick_links.quickLinkCards'
  // The widget draws cards by their `order` where they carry one, and as listed
  // otherwise — so the list is read the same way here, and what moves a card is
  // rewriting every `order`, not only its place in the array.
  const stored: QuickLinkCard[] = Array.isArray(get(PATH)) ? get(PATH) : []
  const cards = stored
    .map((c, i) => ({ c, at: c.order ?? i + 1 }))
    .sort((a, b) => a.at - b.at)
    .map(({ c }) => c)
  const renumber = (list: QuickLinkCard[]) => list.map((c, j) => ({ ...c, order: j + 1 }))
  const update = (next: QuickLinkCard[]) => set(PATH, next)
  const patch = (i: number, p: Partial<QuickLinkCard>) => update(cards.map((c, j) => (j === i ? { ...c, ...p } : c)))
  const move = (i: number, dir: -1 | 1) => {
    const next = [...cards]
    const [c] = next.splice(i, 1)
    next.splice(i + dir, 0, c)
    update(renumber(next))
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <ToggleField label={t('form.quickLinks')} path="widget_v2_config.quick_links.showQuickLinks.value" get={get} set={set} disabled={disabled} />
        <Field label={t('builder.cards.sectionTitle')} path="widget_v2_config.quick_links.displaySettings.sectionTitle" get={get} set={set} disabled={disabled} />
      </div>

      <SectionHead
        aside={
          !disabled && (
            <button
              className="btn-quiet btn-sm -my-1 normal-case"
              onClick={() => update(renumber([...cards, { id: `card-${Date.now().toString(36)}`, title: '', subtitle: '', url: '', active: true }]))}
            >
              <Plus className="size-3.5" />
              {t('builder.cards.add')}
            </button>
          )
        }
      >
        {t('builder.cards.list', { count: cards.length })}
      </SectionHead>

      {cards.length === 0 && <p className="callout">{t('builder.cards.empty')}</p>}
      <ul className="space-y-3">
        {cards.map((c, i) => (
          <li key={c.id ?? i} className="row-in rounded-xl border border-line bg-surface/40 p-3.5" style={{ '--d': i } as React.CSSProperties}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="eyebrow">{t('builder.cards.card', { n: i + 1 })}</span>
              <div className="flex items-center gap-1">
                <label className="me-1 flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-muted">
                  <input type="checkbox" className="size-3.5 accent-[#4d98e2]" checked={c.active !== false} onChange={(e) => patch(i, { active: e.target.checked })} disabled={disabled} />
                  {t('builder.cards.active')}
                </label>
                <button className="btn-ghost btn-sm" onClick={() => move(i, -1)} disabled={disabled || i === 0} title={t('builder.moveUp')} aria-label={t('builder.moveUp')}><ArrowUp className="size-3.5" /></button>
                <button className="btn-ghost btn-sm" onClick={() => move(i, 1)} disabled={disabled || i === cards.length - 1} title={t('builder.moveDown')} aria-label={t('builder.moveDown')}><ArrowDown className="size-3.5" /></button>
                <button className="btn-danger btn-sm" onClick={() => update(cards.filter((_, j) => j !== i))} disabled={disabled} title={t('common.delete')} aria-label={t('common.delete')}><Trash2 className="size-3.5" /></button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">{t('builder.cards.title')}</label>
                <input className="input" value={c.title ?? ''} onChange={(e) => patch(i, { title: e.target.value })} disabled={disabled} />
              </div>
              <div>
                <label className="label">{t('builder.cards.subtitle')}</label>
                <input className="input" value={c.subtitle ?? ''} onChange={(e) => patch(i, { subtitle: e.target.value })} disabled={disabled} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">{t('builder.cards.message')}</label>
                <input
                  className="input"
                  value={c.message ?? ''}
                  placeholder={c.title || t('builder.cards.messagePlaceholder')}
                  onChange={(e) => patch(i, { message: e.target.value })}
                  disabled={disabled}
                />
                <p className="fine mt-1.5">{t('builder.cards.messageHint')}</p>
              </div>
              <div className="sm:col-span-2">
                <MediaInput label={t('builder.cards.image')} value={c.url ?? ''} onChange={(v) => patch(i, { url: v })} disabled={disabled} />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Disclosure summary={t('builder.cards.layout')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.cards.layoutMode')} path={q('layout')} options={[...CARD_LAYOUTS]} keyPrefix="builder.cards.layoutMode" fallback="carousel" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.chips.gap')} path={q('gap')} min={0} max={32} step={1} fallback={8} unit="px" get={get} set={set} disabled={disabled} />
          {carousel && (
            <>
              <ToggleField label={t('builder.cards.autoScroll')} path={q('autoScroll')} get={get} set={set} disabled={disabled} />
              <ToggleField label={t('builder.cards.loop')} path={q('loop')} get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.cards.interval')} path={q('intervalMs')} min={800} max={20000} step={100} fallback={3000} unit="ms" get={get} set={set} disabled={disabled} />
              <NumField label={t('builder.cards.cardWidth')} path={q('cardWidth')} min={48} max={320} step={2} fallback={92} unit="px" get={get} set={set} disabled={disabled} />
            </>
          )}
        </div>
        {carousel && <p className="fine mt-2">{t('builder.cards.autoScrollHint')}</p>}
      </Disclosure>

      <Disclosure summary={t('builder.cards.surface')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorField label={t('builder.chips.bg')} path={q('background')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.radius')} path={q('radius')} min={0} max={60} step={1} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.borderStyle')} path={q('borderStyle')} options={[...BORDER_STYLES]} keyPrefix="builder.input.borderStyle" fallback="solid" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.borderWidth')} path={q('borderWidth')} min={0} max={8} step={0.5} fallback={1} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.borderColor')} path={q('borderColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.cards.padding')} path={q('padding')} min={0} max={40} step={1} fallback={10} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.chips.hoverBg')} path={q('hoverBackground')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.chips.hoverBorder')} path={q('hoverBorderColor')} get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.input.shadow')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ShadowFields base={q('shadow')} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.cards.imageStyle')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.cards.showImage')} path={q('showImage')} fallback get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.cards.imageHeight')} path={q('imageHeight')} min={0} max={260} step={2} fallback={84} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.cards.imageFit')} path={q('imageFit')} options={[...IMAGE_FITS]} keyPrefix="builder.cards.imageFit" fallback="cover" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.cards.imageRadius')} path={q('imageRadius')} min={0} max={60} step={1} fallback={10} unit="px" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.cards.imageAsIcon')} path={q('imageAsIcon')} get={get} set={set} disabled={disabled} />
          {get(q('imageAsIcon')) === true && (
            <NumField label={t('builder.cards.iconSize')} path={q('iconSize')} min={12} max={64} step={1} fallback={24} unit="px" get={get} set={set} disabled={disabled} />
          )}
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.cards.text')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.cards.showCardTitle')} path={q('showTitle')} fallback get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.cards.showSubtitle')} path={q('showSubtitle')} fallback get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.cards.titleColor')} path={q('titleColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.cards.titleSize')} path={q('titleSize')} min={8} max={28} step={0.5} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.cards.titleWeight')} path={q('titleWeight')} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="700" get={get} set={set} disabled={disabled} />
          <FontField label={t('builder.cards.titleFont')} path={q('titleFont')} get={get} set={set} disabled={disabled} allowInherit />
          <BrandColorField label={t('builder.cards.subColor')} path={q('subtitleColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.cards.subSize')} path={q('subtitleSize')} min={7} max={24} step={0.5} fallback={10.5} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.cards.subWeight')} path={q('subtitleWeight')} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="400" get={get} set={set} disabled={disabled} />
          <FontField label={t('builder.cards.subFont')} path={q('subtitleFont')} get={get} set={set} disabled={disabled} allowInherit />
          <ChoiceField label={t('builder.chips.align')} path={q('align')} options={[...TEXT_ALIGNS]} keyPrefix="builder.align" fallback="start" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>
    </div>
  )
}
