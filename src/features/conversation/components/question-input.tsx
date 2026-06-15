import { SendIcon } from '@/components/icons/send-icon'
import { Spinner } from '@/components/ui/spinner'
import { useWidgetConfigContext } from '@/contexts/widget-config-context'
import { cn } from '@/lib/utils'
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useQuestionContext } from '../contexts/question-context'
import { useSendMessage } from '../hooks/use-send-message'
import type { Message } from '../types/message'

interface QuestionInputProps {
  conversationId: string | null
  messages: Message[]
}

export function QuestionInput({ conversationId }: QuestionInputProps) {
  const { activeQuestionGroup, answers, toggleAnswer, dismissQuestionGroup, setQuestionIndex } = useQuestionContext()
  const { mutateAsync: sendMessageMutation } = useSendMessage()
  const { widgetConfig } = useWidgetConfigContext()
  const [isSending, setIsSending] = useState(false)

  if (!activeQuestionGroup) return null

  const { questions, activeQuestionIndex, messageUlid } = activeQuestionGroup
  const question = questions[activeQuestionIndex]
  if (!question) return null

  const isMulti = question.input_type === 'multi'
  const selectedAnswers = answers[question.question] || []
  const hasSelection = selectedAnswers.length > 0

  const currentNumber = activeQuestionIndex + 1
  const totalQuestions = questions.length

  // User must answer all questions before submitting
  const allAnswered = questions.every((q) => (answers[q.question] || []).length > 0)

  const handlePrev = () => {
    if (activeQuestionIndex > 0) {
      setQuestionIndex(activeQuestionIndex - 1)
    }
  }

  const handleNext = () => {
    if (activeQuestionIndex < totalQuestions - 1 && hasSelection) {
      setQuestionIndex(activeQuestionIndex + 1)
    }
  }

  const handleDismiss = () => {
    dismissQuestionGroup(messageUlid)
  }

  const formatAnswers = (ansList: string[]) => {
    if (ansList.length === 0) return ''
    if (ansList.length === 1) return ansList[0]
    if (ansList.length === 2) return `${ansList[0]} and ${ansList[1]}`

    const allButLast = ansList.slice(0, -1).join(', ')
    const last = ansList[ansList.length - 1]
    return `${allButLast}, and ${last}`
  }

  const handleAction = async () => {
    if (!allAnswered) return

    // Compile all answers and submit!
    setIsSending(true)

    const content = questions
      .map((q, idx) => {
        const ansList = answers[q.question] || []
        const formatted = formatAnswers(ansList)
        return `Q${idx + 1}: ${q.question}\nA: ${formatted}`
      })
      .join('\n\n')

    try {
      await sendMessageMutation({
        ...(conversationId ? { conversation_id: conversationId } : {}),
        content,
        message_type: 'text',
      })
      dismissQuestionGroup(messageUlid)
    } catch (err) {
      toast.error('Failed to submit answers. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const isLastQuestion = activeQuestionIndex === totalQuestions - 1
  const isButtonDisabled = isLastQuestion ? !hasSelection || !allAnswered || isSending : !hasSelection

  const handleButtonClick = isLastQuestion ? handleAction : handleNext

  const isFullWidth = widgetConfig.chatInput.layout === 'full_width_bar'

  return (
    <div className={isFullWidth ? 'w-full p-4' : 'w-full px-4 pt-4 pb-6'}>
      {/* Outer Card Container */}
      <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-[#CAC8C6] bg-white shadow-[0_-4px_18.4px_0_rgba(173,147,50,0.06)] select-none">
        {/* Header Block */}
        <div className="flex flex-col items-start gap-2 self-stretch border-b border-[#E5E4E1] bg-white px-4 pt-4 pb-2">
          {/* Navigation & Dismiss controls */}
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrev}
                disabled={activeQuestionIndex <= 0}
                className="rounded p-1 transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Previous question"
              >
                <ChevronLeft className="size-4 text-[#616161]" />
              </button>
              <span className="min-w-8 text-center font-(family-name:--Font-primary,'DM_Sans') text-xs font-normal text-[#616161]">
                {currentNumber} of {totalQuestions}
              </span>
              <button
                type="button"
                onClick={handleNext}
                disabled={activeQuestionIndex >= totalQuestions - 1 || !hasSelection}
                className="rounded p-1 transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Next question"
              >
                <ChevronRight className="size-4 text-[#616161]" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded p-1 transition-colors hover:bg-black/5"
              aria-label="Close question input"
            >
              <X className="size-4 text-[#616161]" />
            </button>
          </div>

          {/* Question Title */}
          <h3 className="font-(family-name:--Font-primary,'DM_Sans') text-base leading-[150%] font-semibold text-[#1A1A1A]">
            {question.question}
          </h3>
        </div>

        {/* Answers Selection Area */}
        {!isMulti ? (
          /* Single Select Stack */
          <div className="flex max-h-65 w-full flex-col overflow-y-auto">
            {question.options.map((option) => {
              const isSelected = selectedAnswers.includes(option)

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleAnswer(question.question, option, 'single')}
                  className="flex w-full items-center gap-2 border-b border-[#E5E4E1] bg-white p-4 text-left font-(family-name:--Font-primary,'DM_Sans') text-sm text-[#1A1A1A] transition-colors last:border-b-0 hover:bg-[#F9F9FB]"
                >
                  {/* Radio Indicator */}
                  <div
                    className={cn(
                      'flex size-4.5 shrink-0 items-center justify-center rounded-full border transition-all duration-200',
                      isSelected ? 'border-[#1B160E]' : 'border-[#E5E4E1]',
                    )}
                  >
                    {isSelected && <div className="animate-scale-up size-2.5 rounded-full bg-[#1B160E]" />}
                  </div>

                  <span>{option}</span>
                </button>
              )
            })}
          </div>
        ) : (
          /* Multi Select Stack */
          <div className="flex flex-col items-start gap-2.5 self-stretch bg-white p-4">
            {/* Guide Text */}
            <span className="font-(family-name:--Font-primary,'DM_Sans') text-xs leading-[130%] font-normal text-[#616161]">
              Choose all that apply
            </span>

            {/* Horizontal Wrap Options Container */}
            <div className="flex max-h-40 w-full flex-wrap gap-2.5 overflow-y-auto">
              {question.options.map((option) => {
                const isSelected = selectedAnswers.includes(option)

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleAnswer(question.question, option, 'multi')}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border border-[#E5E4E1] px-3 py-2 font-(family-name:--Font-primary,'DM_Sans') text-sm leading-[130%] font-normal transition-all duration-200",
                      isSelected ? 'bg-(--Surface-Tertiary,#EEECE1)' : 'bg-(--Surface-Base,#FFF)',
                    )}
                  >
                    {isSelected && <Check className="size-3.5 stroke-[2.5px] text-[#1A1A1A]" />}
                    <span className="text-[#1A1A1A]">{option}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer Block */}
        <div className="flex w-full flex-col items-end gap-2 border-t border-[#E5E4E1] bg-white px-4 pt-3 pb-4">
          {/* Submit / Next Button aligned to right */}
          <button
            type="button"
            disabled={isButtonDisabled}
            onClick={handleButtonClick}
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1E1E1E] text-white transition-colors hover:bg-[#333333]',
              (isButtonDisabled || isSending) && 'cursor-not-allowed opacity-40 hover:bg-[#1E1E1E]',
            )}
            style={isLastQuestion ? widgetConfig.chatInput.sendButtonIcon.styles : undefined}
            aria-label={isLastQuestion ? 'Send message' : 'Next question'}
          >
            {isLastQuestion ? (
              isSending ? (
                <Spinner className="size-4 text-white" />
              ) : (
                <SendIcon className="size-3 text-white" variant={widgetConfig.chatInput.sendButtonIcon.variant} />
              )
            ) : (
              <ChevronRight className="size-4 text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
