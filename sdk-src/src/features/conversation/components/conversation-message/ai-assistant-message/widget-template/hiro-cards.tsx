import type {
  HiroBodySnapshotTemplate,
  HiroProgressTrendTemplate,
  HiroBodyCompositionTemplate,
  HiroGoalProgressTemplate,
  HiroMacroTargetsTemplate,
  HiroMuscleBalanceTemplate,
  HiroMealCardsTemplate,
  HiroMealPlanTemplate,
  HiroWorkoutPlanTemplate,
  HiroExerciseCardsTemplate,
  HiroInsightTemplate,
} from '@/features/conversation/types/hiro-templates'
import {
  HiroBodySnapshotView,
  HiroProgressTrendView,
  HiroBodyCompositionView,
  HiroGoalProgressView,
  HiroMacroTargetsView,
  HiroMuscleBalanceView,
  HiroMealCardsView,
  HiroMealPlanView,
  HiroWorkoutPlanView,
  HiroExerciseCardsView,
  HiroInsightView,
} from './hiro-cards-view'
import { useTemplateDesign } from './use-template-design'

/**
 * The widget's side of Hiro's cards: each resolves its design from the widget's
 * theme and hands it to the shared view (hiro-cards-view.tsx), which the
 * studio's Templates page draws too.
 */

export function HiroBodySnapshot({ template }: { template: HiroBodySnapshotTemplate; sourceMessageUlid?: string }) {
  return <HiroBodySnapshotView content={template.content ?? {}} d={useTemplateDesign(template.content)} />
}

export function HiroProgressTrend({ template }: { template: HiroProgressTrendTemplate; sourceMessageUlid?: string }) {
  return <HiroProgressTrendView content={template.content ?? {}} d={useTemplateDesign(template.content)} />
}

export function HiroBodyComposition({
  template,
}: {
  template: HiroBodyCompositionTemplate
  sourceMessageUlid?: string
}) {
  return <HiroBodyCompositionView content={template.content ?? {}} d={useTemplateDesign(template.content)} />
}

export function HiroGoalProgress({ template }: { template: HiroGoalProgressTemplate; sourceMessageUlid?: string }) {
  return <HiroGoalProgressView content={template.content ?? {}} d={useTemplateDesign(template.content)} />
}

export function HiroMacroTargets({ template }: { template: HiroMacroTargetsTemplate; sourceMessageUlid?: string }) {
  return <HiroMacroTargetsView content={template.content ?? {}} d={useTemplateDesign(template.content)} />
}

export function HiroMuscleBalance({ template }: { template: HiroMuscleBalanceTemplate; sourceMessageUlid?: string }) {
  return <HiroMuscleBalanceView content={template.content ?? {}} d={useTemplateDesign(template.content)} />
}

export function HiroMealCards({ template }: { template: HiroMealCardsTemplate; sourceMessageUlid?: string }) {
  return <HiroMealCardsView content={template.content ?? {}} d={useTemplateDesign(template.content)} />
}

export function HiroMealPlan({ template }: { template: HiroMealPlanTemplate; sourceMessageUlid?: string }) {
  return <HiroMealPlanView content={template.content ?? {}} d={useTemplateDesign(template.content)} />
}

export function HiroWorkoutPlan({ template }: { template: HiroWorkoutPlanTemplate; sourceMessageUlid?: string }) {
  return <HiroWorkoutPlanView content={template.content ?? {}} d={useTemplateDesign(template.content)} />
}

export function HiroExerciseCards({ template }: { template: HiroExerciseCardsTemplate; sourceMessageUlid?: string }) {
  return <HiroExerciseCardsView content={template.content ?? {}} d={useTemplateDesign(template.content)} />
}

export function HiroInsight({ template }: { template: HiroInsightTemplate; sourceMessageUlid?: string }) {
  return <HiroInsightView content={template.content ?? {}} d={useTemplateDesign(template.content)} />
}
