import { createContext, type ReactNode, useContext, useState, useCallback } from 'react'
import type { QuestionMessage } from '../types/message'

export interface ActiveQuestionGroup {
  messageUlid: string
  questions: QuestionMessage[]
  activeQuestionIndex: number
}

interface QuestionContextType {
  activeQuestionGroup: ActiveQuestionGroup | null
  answers: Record<string, string[]>
  dismissedQuestions: string[]
  setActiveQuestionGroup: (group: ActiveQuestionGroup | null) => void
  setQuestionIndex: (index: number) => void
  toggleAnswer: (questionText: string, option: string, inputType: string) => void
  clearQuestion: () => void
  dismissQuestionGroup: (messageUlid: string) => void
}

const QuestionContext = createContext<QuestionContextType | undefined>(undefined)

export function QuestionProvider({ children }: { children: ReactNode }) {
  const [activeQuestionGroup, setActiveQuestionGroupState] = useState<ActiveQuestionGroup | null>(null)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [dismissedQuestions, setDismissedQuestions] = useState<string[]>([])

  const setActiveQuestionGroup = useCallback((group: ActiveQuestionGroup | null) => {
    setActiveQuestionGroupState(group)
    if (group) {
      setAnswers((prev) => {
        const next = { ...prev }
        group.questions.forEach((q) => {
          next[q.question] = []
        })
        return next
      })
    }
  }, [])

  const setQuestionIndex = useCallback((index: number) => {
    setActiveQuestionGroupState((prev) => {
      if (!prev) return null
      return { ...prev, activeQuestionIndex: index }
    })
  }, [])

  const toggleAnswer = useCallback((questionText: string, option: string, inputType: string) => {
    setAnswers((prev) => {
      const current = prev[questionText] || []
      let next: string[]
      if (inputType === 'single') {
        next = current.includes(option) ? [] : [option]
      } else {
        next = current.includes(option) ? current.filter((o) => o !== option) : [...current, option]
      }
      return { ...prev, [questionText]: next }
    })
  }, [])

  const clearQuestion = useCallback(() => {
    setActiveQuestionGroupState(null)
    setAnswers({})
  }, [])

  const dismissQuestionGroup = useCallback((messageUlid: string) => {
    setDismissedQuestions((prev) => [...prev, messageUlid])
    setActiveQuestionGroupState(null)
    setAnswers({})
  }, [])

  return (
    <QuestionContext.Provider
      value={{
        activeQuestionGroup,
        answers,
        dismissedQuestions,
        setActiveQuestionGroup,
        setQuestionIndex,
        toggleAnswer,
        clearQuestion,
        dismissQuestionGroup,
      }}
    >
      {children}
    </QuestionContext.Provider>
  )
}

export function useQuestionContext() {
  const context = useContext(QuestionContext)
  if (context === undefined) {
    throw new Error('useQuestionContext must be used within a QuestionProvider')
  }
  return context
}
