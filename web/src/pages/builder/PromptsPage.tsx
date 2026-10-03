import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { IconField } from '@/components/IconField'
import { Disclosure, SectionHead } from '@/components/ui'
import { BORDER_STYLES, CHIP_LAYOUTS, FONT_WEIGHTS, ICON_POSITIONS, TEXT_ALIGNS } from '@/lib/inputDesign'
import { useI18n } from '@/lib/i18n'
import {
  BrandColorField, ChoiceField, Field, FontField, NumField, ShadowFields, ToggleField, type PageProps,
} from './fields'

interface PromptChip { text?: string; icon?: string; iconUrl?: string }

const PROMPTS = 'widget_v2_config.trending_prompts.design'

export function PromptsPage({ get, set: write, disabled }: PageProps) {
  const { t } = useI18n()
  // A widget that has never had a prompt design (one imported from Pair) draws
  // its heading and icons the way `displaySettings` says; once a design exists
  // the design decides. The first design field saved would otherwise flip both
  // to the design's defaults, so that first write pins them to what the live
  // widget shows today.
  const hasDesign = get(PROMPTS) != null
  const liveTitle = get('widget_v2_config.trending_prompts.displaySettings.showTitle') === true
  const liveIcons = get('widget_v2_config.trending_prompts.displaySettings.showIcons') === true
  const set: typeof write = (path, val) => {
    if (!hasDesign && path.startsWith(`${PROMPTS}.`)) {
      if (path !== `${PROMPTS}.showTitle`) write(`${PROMPTS}.showTitle`, liveTitle)
      if (path !== `${PROMPTS}.showIcon`) write(`${PROMPTS}.showIcon`, liveIcons)
    }
    write(path, val)
  }
  const PATH = 'widget_v2_config.trending_prompts.promptChips'
  const chips: PromptChip[] = Array.isArray(get(PATH)) ? get(PATH) : []
  const update = (next: PromptChip[]) => set(PATH, next)
  const patch = (i: number, p: Partial<PromptChip>) => update(chips.map((c, j) => (j === i ? { ...c, ...p } : c)))
  const move = (i: number, dir: -1 | 1) => {
    const next = [...chips]
    const [c] = next.splice(i, 1)
    next.splice(i + dir, 0, c)
    update(next)
  }
  const p = (k: string) => `${PROMPTS}.${k}`
  const iconsOn = hasDesign ? get(p('showIcon')) === true : liveIcons
  // Alignment places the chips in their row or column; a single scrolling row has no room to place them in.
  const alignable = (get(p('layout')) ?? 'wrap') !== 'scroll'

  return (
    <div className="space-y-2.5">
      <section>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('form.trending')} path="widget_v2_config.trending_prompts.showTrendingPrompts.value" get={get} set={set} disabled={disabled} />
          <Field label={t('form.promptsTitle')} path="widget_v2_config.trending_prompts.displaySettings.sectionTitle" get={get} set={set} disabled={disabled} />
        </div>
      </section>

      <section>
        <SectionHead
          aside={
            !disabled && (
              <button className="btn-quiet btn-sm -my-1 normal-case" onClick={() => update([...chips, { text: '' }])}>
                <Plus className="size-3.5" />
                {t('builder.chips.add')}
              </button>
            )
          }
        >
          {t('builder.chips.list', { count: chips.length })}
        </SectionHead>
        {chips.length === 0 && <p className="callout">{t('builder.chips.empty')}</p>}
        <ul className="space-y-2">
          {chips.map((c, i) => (
            <li key={i} className="row-in rounded-xl border border-line bg-surface/40 p-2.5" style={{ '--d': i } as React.CSSProperties}>
              <div className="flex items-center gap-2">
                <input
                  className="input"
                  value={c.text ?? ''}
                  placeholder={t('builder.chips.placeholder')}
                  onChange={(e) => patch(i, { text: e.target.value })}
                  disabled={disabled}
                />
                <button className="btn-ghost btn-sm shrink-0" onClick={() => move(i, -1)} disabled={disabled || i === 0} title={t('builder.moveUp')} aria-label={t('builder.moveUp')}><ArrowUp className="size-3.5" /></button>
                <button className="btn-ghost btn-sm shrink-0" onClick={() => move(i, 1)} disabled={disabled || i === chips.length - 1} title={t('builder.moveDown')} aria-label={t('builder.moveDown')}><ArrowDown className="size-3.5" /></button>
                <button className="btn-danger btn-sm shrink-0" onClick={() => update(chips.filter((_, j) => j !== i))} disabled={disabled} title={t('common.delete')} aria-label={t('common.delete')}>
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              {iconsOn && (
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <IconField
                    label={t('builder.chips.chipIcon', { n: i + 1 })} set="card" allowNone allowDefault
                    // An image with no icon name is how Pair stores a chip's icon, and the widget draws it.
                    value={c.icon || (c.iconUrl ? 'custom' : undefined)} url={c.iconUrl}
                    // Back to the default means dropping the upload too, or the widget would keep drawing it.
                    onChange={(v) => patch(i, v === 'default' ? { icon: undefined, iconUrl: undefined } : { icon: v })}
                    onUrlChange={(v) => patch(i, { iconUrl: v })}
                    disabled={disabled}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
        {iconsOn && chips.length > 0 && <p className="fine mt-2">{t('builder.chips.chipIconHint')}</p>}
      </section>

      <Disclosure summary={t('builder.chips.section')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.chips.showTitle')} path={p('showTitle')} fallback={hasDesign || liveTitle} get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.chips.layout')} path={p('layout')} options={[...CHIP_LAYOUTS]} keyPrefix="builder.chips.layout" fallback="wrap" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.chips.titleColor')} path={p('titleColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.chips.titleSize')} path={p('titleSize')} min={8} max={28} step={0.5} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.chips.titleWeight')} path={p('titleWeight')} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="700" get={get} set={set} disabled={disabled} />
          <FontField label={t('builder.chips.titleFont')} path={p('titleFont')} get={get} set={set} disabled={disabled} allowInherit />
          <NumField label={t('builder.chips.gap')} path={p('gap')} min={0} max={32} step={1} fallback={8} unit="px" get={get} set={set} disabled={disabled} />
          {alignable && (
            <ChoiceField label={t('builder.chips.chipAlign')} path={p('align')} options={[...TEXT_ALIGNS]} keyPrefix="builder.align" fallback="start" get={get} set={set} disabled={disabled} />
          )}
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.chips.surface')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorField label={t('builder.chips.bg')} path={p('background')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.radius')} path={p('radius')} min={0} max={999} step={1} fallback={20} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.borderStyle')} path={p('borderStyle')} options={[...BORDER_STYLES]} keyPrefix="builder.input.borderStyle" fallback="solid" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.borderWidth')} path={p('borderWidth')} min={0} max={8} step={0.5} fallback={1} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.input.borderColor')} path={p('borderColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.padX')} path={p('paddingX')} min={0} max={40} step={1} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.padY')} path={p('paddingY')} min={0} max={40} step={1} fallback={7} unit="px" get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.chips.hoverBg')} path={p('hoverBackground')} get={get} set={set} disabled={disabled} />
          <BrandColorField label={t('builder.chips.hoverBorder')} path={p('hoverBorderColor')} get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.input.shadow')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ShadowFields base={p('shadow')} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.chips.text')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorField label={t('builder.input.textColor')} path={p('textColor')} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.textSize')} path={p('textSize')} min={8} max={28} step={0.5} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.input.textWeight')} path={p('textWeight')} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="400" get={get} set={set} disabled={disabled} />
          <FontField label={t('builder.input.font')} path={p('textFont')} get={get} set={set} disabled={disabled} allowInherit />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.chips.icon')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.chips.showIcon')} path={p('showIcon')} fallback={!hasDesign && liveIcons} get={get} set={set} disabled={disabled} />
          {iconsOn && (
            <>
              <ChoiceField label={t('builder.chips.iconPos')} path={p('iconPosition')} options={[...ICON_POSITIONS]} keyPrefix="builder.chips.iconPos" fallback="start" get={get} set={set} disabled={disabled} />
              <IconField
                label={t('builder.chips.defaultIcon')} set="card"
                value={get(p('icon'))} url={get(p('iconUrl'))}
                onChange={(v) => set(p('icon'), v)} onUrlChange={(v) => set(p('iconUrl'), v)}
                disabled={disabled}
              />
              <NumField label={t('builder.input.iconSize')} path={p('iconSize')} min={6} max={40} step={0.5} fallback={13} unit="px" get={get} set={set} disabled={disabled} />
              <BrandColorField label={t('builder.chips.iconColor')} path={p('iconColor')} get={get} set={set} disabled={disabled} />
            </>
          )}
        </div>
        {iconsOn && <p className="fine mt-2">{t('builder.chips.iconHint')}</p>}
      </Disclosure>
    </div>
  )
}
