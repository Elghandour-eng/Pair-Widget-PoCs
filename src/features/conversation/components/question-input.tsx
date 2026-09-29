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
  const { iconColor, ...buttonStyles } = widgetConfig.chatInput.sendButtonIcon.styles || {}
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

  // Joiners and prefixes always follow the question's own language — an Arabic
  // conversation never sees "and", "Q1:" or English helper copy.
  const isArabicQ = /[\u0600-\u06FF]/.test(questions.map((q) => q.question + q.options.join('')).join(''))

  const formatAnswers = (ansList: string[]) => {
    if (ansList.length === 0) return ''
    if (ansList.length === 1) return ansList[0]
    if (isArabicQ) {
      if (ansList.length === 2) return `${ansList[0]} و${ansList[1]}`
      return `${ansList.slice(0, -1).join('، ')} و${ansList[ansList.length - 1]}`
    }
    if (ansList.length === 2) return `${ansList[0]} and ${ansList[1]}`
    const allButLast = ansList.slice(0, -1).join(', ')
    const last = ansList[ansList.length - 1]
    return `${allButLast}, and ${last}`
  }

  const handleAction = async () => {
    if (!allAnswered) return

    // Compile all answers and submit!
    setIsSending(true)

    // One question sends just the answer; several send localized Q/A pairs.
    const content =
      questions.length === 1
        ? formatAnswers(answers[questions[0].question] || [])
        : questions
            .map((q, idx) => {
              const ansList = answers[q.question] || []
              const formatted = formatAnswers(ansList)
              return isArabicQ
                ? `س${idx + 1}: ${q.question}\nج: ${formatted}`
                : `Q${idx + 1}: ${q.question}\nA: ${formatted}`
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

  // Card design: studio config wins, then the brand colour and theme defaults.
  const qd = widgetConfig.messagesConfig?.questions
  const brand = widgetConfig.primaryColor || '#B3202C'
  const accent = qd?.accentColor ?? brand
  const cardBg = qd?.background ?? '#fff'
  const cardBorder = qd?.borderColor ?? `${brand}40`
  const cardText = qd?.textColor ?? '#1A1A1A'
  const cardRadius = qd?.radius != null ? `${qd.radius}px` : '18px'

  return (
    <div className={isFullWidth ? 'w-full p-4' : 'w-full px-4 pt-4 pb-6'}>
      {/* Outer Card Container */}
      <div
        dir={isArabicQ ? 'rtl' : 'ltr'}
        className="flex w-full flex-col overflow-hidden border select-none"
        style={{
          background: cardBg,
          borderColor: cardBorder,
          borderRadius: cardRadius,
          color: cardText,
          boxShadow: `0 8px 28px ${accent}14`,
        }}
      >
        {/* Header Block */}
        <div
          className="flex flex-col items-start gap-2 self-stretch border-b px-4 pt-4 pb-2"
          style={{ borderColor: `${accent}1f` }}
        >
          {/* Navigation & Dismiss controls */}
          <div className="flex w-full items-center justify-between">
            <div className={totalQuestions > 1 ? 'flex items-center gap-1.5' : 'hidden'}>
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
                {isArabicQ ? `${currentNumber} من ${totalQuestions}` : `${currentNumber} of ${totalQuestions}`}
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
          <h3
            className="font-(family-name:--Font-primary,'DM_Sans') text-base leading-[150%] font-semibold"
            dir="auto"
            style={{ color: cardText }}
          >
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
                  dir={isArabicQ ? 'rtl' : 'ltr'}
                  className="flex w-full items-center gap-2.5 border-b p-4 text-start font-(family-name:--Font-primary,'DM_Sans') text-sm transition-colors last:border-b-0"
                  style={{
                    borderColor: `${accent}14`,
                    color: cardText,
                    background: isSelected ? `${accent}0d` : 'transparent',
                  }}
                >
                  {/* Radio Indicator */}
                  <div
                    className="flex size-4.5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200"
                    style={{ borderColor: isSelected ? accent : `${accent}45` }}
                  >
                    {isSelected && (
                      <div className="animate-scale-up size-2.5 rounded-full" style={{ background: accent }} />
                    )}
                  </div>

                  <span dir="auto">{option}</span>
                </button>
              )
            })}
          </div>
        ) : (
          /* Multi Select Stack */
          <div className="flex flex-col items-start gap-2.5 self-stretch p-4">
            {/* Guide Text */}
            <span className="font-(family-name:--Font-primary,'DM_Sans') text-xs leading-[130%] font-normal text-[#616161]">
              {isArabicQ ? 'اختار كل اللي يناسبك' : 'Choose all that apply'}
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
                    dir="auto"
                    className="flex items-center gap-1.5 rounded-full border px-3.5 py-2 font-(family-name:--Font-primary,'DM_Sans') text-sm leading-[130%] font-normal transition-all duration-200"
                    style={{
                      borderColor: isSelected ? accent : `${accent}40`,
                      background: isSelected ? `${accent}12` : cardBg,
                      color: cardText,
                    }}
                  >
                    {isSelected && <Check className="size-3.5 stroke-[2.5px]" style={{ color: accent }} />}
                    <span>{option}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer Block */}
        <div
          className="flex w-full flex-col items-end gap-2 border-t px-4 pt-3 pb-4"
          style={{ borderColor: `${accent}1f` }}
        >
          {/* Submit / Next Button aligned to right */}
          <button
            type="button"
            disabled={isButtonDisabled}
            onClick={handleButtonClick}
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1E1E1E] text-white transition-colors hover:bg-[#333333]',
              (isButtonDisabled || isSending) && 'cursor-not-allowed opacity-40 hover:bg-[#1E1E1E]',
            )}
            style={isLastQuestion ? buttonStyles : undefined}
            aria-label={isLastQuestion ? 'Send message' : 'Next question'}
          >
            {isLastQuestion ? (
              isSending ? (
                <Spinner className="size-4 text-white" />
              ) : (
                <SendIcon
                  className={cn('size-3', !iconColor && 'text-white')}
                  style={iconColor ? { color: iconColor } : undefined}
                  variant={widgetConfig.chatInput.sendButtonIcon.variant}
                />
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
