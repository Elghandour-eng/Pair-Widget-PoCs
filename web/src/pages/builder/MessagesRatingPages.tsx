import { MediaInput } from '@/components/MediaInput'
import { Disclosure, SectionHead } from '@/components/ui'
import { type WidgetConfig } from '@/lib/api'
import { FONT_WEIGHTS } from '@/lib/inputDesign'
import { useI18n } from '@/lib/i18n'
import {
  ChoiceField, ColorField, Field, FontField, NumField, PlainBiField, ToggleField, type PageProps,
} from './fields'

export function MessagesPage({ draft, setDraft, get, set, disabled }: { draft: WidgetConfig; setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void } & PageProps) {
  const { t } = useI18n()
  const AI = 'widget_v2_config.messages.aiMessages'
  const LO = 'widget_v2_config.messages.loadingOlder'
  const CU = 'widget_v2_config.messages.customerMessages'
  const FB = 'widget_v2_config.messages.feedback'
  const SG = 'widget_v2_config.messages.suggestions'
  const QC = 'widget_v2_config.messages.questions'
  const ES = 'widget_v2_config.messages.emptyState'
  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('builder.msgs.ai')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.msgs.style')} path={`${AI}.messageStyle`} options={['bubble', 'plain', 'card']} keyPrefix="builder.msgs.style" fallback="bubble" get={get} set={set} disabled={disabled} />
          <div />
          <ColorField label={t('builder.msgs.cardBg')} path={`${AI}.CardStyles.backgroundColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.borderColor')} path={`${AI}.CardStyles.borderColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.borderWidth')} path={`${AI}.CardStyles.borderWidth`} min={0} max={8} step={1} fallback={0} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${AI}.CardStyles.borderRadius`} min={0} max={40} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.padding')} path={`${AI}.CardStyles.padding`} min={0} max={32} step={1} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${AI}.TextStyles.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${AI}.TextStyles.fontSize`} min={10} max={22} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.msgs.textWeight')} path={`${AI}.TextStyles.fontWeight`} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="400" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.msgs.showIcon')} path={`${AI}.showAiIcon`} get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.msgs.aiShimmer')} path={`${AI}.showShimmer`} get={get} set={set} disabled={disabled} />
          <MediaInput label={t('builder.msgs.iconUrl')} value={get(`${AI}.iconUrl`) ?? ''} onChange={(v) => set(`${AI}.iconUrl`, v)} disabled={disabled} />
        </div>
      </section>
      <section>
        <SectionHead>{t('builder.msgs.user')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.msgs.btype')} path={`${CU}.bubbleType`} options={['filled', 'outline']} keyPrefix="builder.msgs.btype" fallback="filled" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.msgs.brandColor')} path={`${CU}.useBrandColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('form.userBubbleBg')} path={`${CU}.bubbleStyle.backgroundColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.borderColor')} path={`${CU}.bubbleStyle.borderColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('form.userBubbleText')} path={`${CU}.TextStyles.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${CU}.TextStyles.fontSize`} min={10} max={22} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ChoiceField label={t('builder.msgs.textWeight')} path={`${CU}.TextStyles.fontWeight`} options={[...FONT_WEIGHTS]} keyPrefix="builder.weight" fallback="400" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.padding')} path={`${CU}.bubbleStyle.padding`} min={0} max={32} step={1} fallback={12} unit="px" get={get} set={set} disabled={disabled} />
          <Field label={t('form.bubbleRadius')} path={`${CU}.bubbleStyle.borderRadius`} get={get} set={set} disabled={disabled} placeholder="18px 18px 4px 18px" />
        </div>
      </section>
      <section>
        <SectionHead>{t('builder.msgs.loadMoreHead')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <PlainBiField label={t('builder.msgs.loadMoreText')} path={`${LO}.text`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Loading older messages…" />
          </div>
          <ColorField label={t('builder.msgs.loadMoreBg')} path={`${LO}.background`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${LO}.textColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.loadMoreSpinner')} path={`${LO}.spinnerColor`} get={get} set={set} disabled={disabled} />
        </div>
      </section>
      <section>
        <SectionHead>{t('builder.msgs.qcardHead')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.msgs.qcardAccent')} path={`${QC}.accentColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.qcardRadius')} path={`${QC}.radius`} min={0} max={32} step={1} fallback={18} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.qcardBg')} path={`${QC}.background`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.qcardText')} path={`${QC}.textColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.qcardBorder')} path={`${QC}.borderColor`} get={get} set={set} disabled={disabled} />
        </div>
      </section>
      <section>
        <SectionHead>{t('builder.msgs.chipsHead')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.msgs.chipsAlign')} path={`${SG}.align`} options={['start', 'center', 'end']} keyPrefix="builder.msgs.chipsAlign" fallback="center" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.chipsRadius')} path={`${SG}.radius`} min={0} max={40} step={1} fallback={999} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.chipsBg')} path={`${SG}.background`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.chipsText')} path={`${SG}.textColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.chipsBorder')} path={`${SG}.borderColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.chipsSize')} path={`${SG}.fontSize`} min={10} max={18} step={0.5} fallback={13.5} unit="px" get={get} set={set} disabled={disabled} />
        </div>
      </section>
      <section>
        <SectionHead>{t('builder.msgs.emptyHead')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('builder.msgs.emptyEn')} path={`${ES}.text`} placeholder="Send a message to start the conversation!" get={get} set={set} disabled={disabled} />
          <Field label={t('builder.msgs.emptyAr')} path={`${ES}.text_ar`} placeholder="ابدأ المحادثة برسالة ✨" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.emptySize')} path={`${ES}.fontSize`} min={10} max={24} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.emptyColor')} path={`${ES}.color`} get={get} set={set} disabled={disabled} />
        </div>
      </section>
      <section>
        <SectionHead>{t('builder.msgs.feedbackHead')}</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label={t('builder.msgs.feedback')} path={`${FB}.showFeedbackButtons`} get={get} set={set} disabled={disabled} />
          <Field label={t('builder.msgs.toastMsg')} path={`${FB}.toastMessage`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.fbIconSize')} path={`${FB}.style.iconSize`} min={12} max={40} step={1} fallback={24} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.fbIconColor')} path={`${FB}.style.iconColor`} get={get} set={set} disabled={disabled} />
        </div>
      </section>
    </div>
  )
}

/* ------------------------------- rating (CSAT) ----------------------------- */

const RT = 'widget_v2_config.csat'
const RTD = `${RT}.design`

/**
 * The rating survey page: the texts the survey shows (overriding what the
 * survey message carries), which type it renders as, and the design of the
 * card, the sheet, the chips or stars, and both buttons.
 */
export function RatingPage({ draft, setDraft, get, set, disabled }: { draft: WidgetConfig; setDraft: (fn: (d: WidgetConfig | null) => WidgetConfig | null) => void } & PageProps) {
  const { t } = useI18n()
  return (
    <div className="space-y-7">
      <section>
        <SectionHead>{t('builder.section.rating')}</SectionHead>
        <p className="callout mb-4">{t('builder.rt.hint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label={t('builder.rt.type')} path={`${RTD}.forceType`} options={['auto', 'star', 'text_options']} keyPrefix="builder.rt.type" fallback="auto" get={get} set={set} disabled={disabled} />
          <div />
          <PlainBiField label={t('builder.rt.header')} path={`${RT}.header`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Customer Satisfaction Survey" />
          <PlainBiField label={t('builder.rt.question')} path={`${RT}.body`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="How was your experience?" />
          <PlainBiField label={t('builder.rt.trigger')} path={`${RT}.buttonText`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Rate Experience" />
          <PlainBiField label={t('builder.rt.submit')} path={`${RT}.submitText`} draft={draft} setDraft={setDraft} disabled={disabled} placeholder="Submit Feedback" />
        </div>
      </section>

      <Disclosure summary={t('builder.rt.card')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.input.fieldBg')} path={`${RTD}.card.background`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.borderColor')} path={`${RTD}.card.borderColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.borderWidth')} path={`${RTD}.card.borderWidth`} min={0} max={8} step={1} fallback={1} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${RTD}.card.radius`} min={0} max={60} step={1} fallback={16} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.padding')} path={`${RTD}.card.padding`} min={0} max={48} step={1} fallback={20} unit="px" get={get} set={set} disabled={disabled} />
          <div />
          <ColorField label={t('builder.rt.header')} path={`${RTD}.header.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${RTD}.header.size`} min={8} max={20} step={0.5} fallback={11} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.rt.question')} path={`${RTD}.body.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${RTD}.body.size`} min={10} max={26} step={0.5} fallback={15} unit="px" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.rt.trigger')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FontField label={t('builder.rt.font')} path={`${RTD}.trigger.fontFamily`} allowInherit get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${RTD}.trigger.textSize`} min={9} max={24} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${RTD}.trigger.textColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.input.fieldBg')} path={`${RTD}.trigger.background`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${RTD}.trigger.radius`} min={0} max={999} step={1} fallback={10} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.borderWidth')} path={`${RTD}.trigger.borderWidth`} min={0} max={8} step={1} fallback={0} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.borderColor')} path={`${RTD}.trigger.borderColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.pc.design.inputHeight')} path={`${RTD}.trigger.height`} min={28} max={72} step={1} fallback={36} unit="px" get={get} set={set} disabled={disabled} />
          <ToggleField label={t('builder.pc.design.fullWidth')} path={`${RTD}.trigger.fullWidth`} get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={`${t('builder.rt.chips')} · ${t('builder.rt.stars')}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.input.fieldBg')} path={`${RTD}.chips.background`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.borderColor')} path={`${RTD}.chips.borderColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${RTD}.chips.textColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${RTD}.chips.radius`} min={0} max={999} step={1} fallback={999} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.rt.selBg')} path={`${RTD}.chips.selectedBackground`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.rt.selBorder')} path={`${RTD}.chips.selectedBorderColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.rt.selText')} path={`${RTD}.chips.selectedTextColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${RTD}.chips.textSize`} min={9} max={20} step={0.5} fallback={13} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.rt.stars')} path={`${RTD}.stars.color`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.input.iconSize')} path={`${RTD}.stars.size`} min={12} max={36} step={1} fallback={20} unit="px" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>

      <Disclosure summary={t('builder.rt.sheet')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t('builder.input.fieldBg')} path={`${RTD}.dialog.background`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${RTD}.dialog.titleColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.borderColor')} path={`${RTD}.dialog.dividerColor`} get={get} set={set} disabled={disabled} />
        </div>
        <p className="eyebrow mt-4 mb-2">{t('builder.rt.submit')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FontField label={t('builder.rt.font')} path={`${RTD}.submit.fontFamily`} allowInherit get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.textSize')} path={`${RTD}.submit.textSize`} min={9} max={24} step={0.5} fallback={14} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.text')} path={`${RTD}.submit.textColor`} get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.input.fieldBg')} path={`${RTD}.submit.background`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.radius')} path={`${RTD}.submit.radius`} min={0} max={999} step={1} fallback={10} unit="px" get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.msgs.borderWidth')} path={`${RTD}.submit.borderWidth`} min={0} max={8} step={1} fallback={0} unit="px" get={get} set={set} disabled={disabled} />
          <ColorField label={t('builder.msgs.borderColor')} path={`${RTD}.submit.borderColor`} get={get} set={set} disabled={disabled} />
          <NumField label={t('builder.pc.design.inputHeight')} path={`${RTD}.submit.height`} min={30} max={72} step={1} fallback={48} unit="px" get={get} set={set} disabled={disabled} />
        </div>
      </Disclosure>
    </div>
  )
}
