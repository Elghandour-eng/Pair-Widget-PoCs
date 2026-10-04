/** The resolved card design the studio sends with every card (see use-template-design). */
export type TemplateDesign = Record<string, string | number | boolean | undefined>

/**
 * Hiro's cards (see server/src/lib/templates/hiro.ts for what the agent may
 * send and how the server tidies it). Every field the server could not vouch
 * for is optional, so a renderer never trusts more than it was given.
 */

interface Base {
  design?: TemplateDesign
  lang?: 'ar' | 'en'
}

export interface HiroBodySnapshotTemplate {
  type: 'hiro_body_snapshot'
  content: Base & {
    title?: string
    date?: string
    score?: number
    items?: Array<{
      key?: string
      label: string
      value: number
      unit?: string
      min?: number
      max?: number
      better?: 'up' | 'down'
    }>
  }
}

export interface HiroProgressTrendTemplate {
  type: 'hiro_progress_trend'
  content: Base & {
    title?: string
    verdict?: string
    series?: Array<{
      key?: string
      label: string
      unit?: string
      better?: 'up' | 'down'
      points: Array<{ date: string; value: number }>
    }>
  }
}

export interface HiroBodyCompositionTemplate {
  type: 'hiro_body_composition'
  content: Base & { title?: string; total?: number; parts?: Array<{ key?: string; label: string; kg: number }> }
}

export interface HiroGoalProgressTemplate {
  type: 'hiro_goal_progress'
  content: Base & { label?: string; current?: number; target?: number; start?: number; unit?: string; note?: string }
}

export interface HiroMacroTargetsTemplate {
  type: 'hiro_macro_targets'
  content: Base & {
    title?: string
    calories?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
    note?: string
  }
}

export interface HiroMuscleBalanceTemplate {
  type: 'hiro_muscle_balance'
  content: Base & {
    title?: string
    unit?: string
    note?: string
    segments?: Array<{ key?: string; label: string; value: number }>
  }
}

export interface HiroMeal {
  name: string
  category?: string
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  image?: string
  video?: string
}

export interface HiroMealCardsTemplate {
  type: 'hiro_meal_cards'
  content: Base & { title?: string; items?: HiroMeal[] }
}

export interface HiroMealPlanTemplate {
  type: 'hiro_meal_plan'
  content: Base & {
    name?: string
    goal?: string
    target_calories?: number
    meals?: HiroMeal[]
    totals?: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
  }
}

export interface HiroExercise {
  name: string
  muscles?: string[]
  sets?: number
  reps?: string
  duration_seconds?: number
  rest_seconds?: number
  description?: string
  image?: string
  video?: string
}

export interface HiroWorkoutPlanTemplate {
  type: 'hiro_workout_plan'
  content: Base & {
    name?: string
    goal?: string
    difficulty?: string
    duration_minutes?: number
    estimated_calories?: number
    muscles?: string[]
    image?: string
    video?: string
    blocks?: Array<{ name: string; exercises: HiroExercise[] }>
  }
}

export interface HiroExerciseCardsTemplate {
  type: 'hiro_exercise_cards'
  content: Base & { title?: string; items?: HiroExercise[] }
}

export interface HiroInsightTemplate {
  type: 'hiro_insight'
  content: Base & { title?: string; tone?: 'good' | 'watch' | 'info'; points?: string[] }
}

export type HiroTemplate =
  | HiroBodySnapshotTemplate
  | HiroProgressTrendTemplate
  | HiroBodyCompositionTemplate
  | HiroGoalProgressTemplate
  | HiroMacroTargetsTemplate
  | HiroMuscleBalanceTemplate
  | HiroMealCardsTemplate
  | HiroMealPlanTemplate
  | HiroWorkoutPlanTemplate
  | HiroExerciseCardsTemplate
  | HiroInsightTemplate

/** Several cards in one reply, drawn one under the other in the order the agent sent them. */
export interface StackTemplate {
  type: 'stack'
  content: Base & { items: Array<{ type: string; content: Record<string, unknown> }> }
}
