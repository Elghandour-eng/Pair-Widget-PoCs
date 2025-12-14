import { cn } from '@/lib/utils'
import EmojiPicker, { type EmojiClickData, EmojiStyle, Theme } from 'emoji-picker-react'
import { useTheme } from 'next-themes'
import { useEffect, useRef } from 'react'

interface EmojiPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (emoji: string) => void
  buttonRef?: React.RefObject<HTMLButtonElement | null>
}

function EmojiPickerWrapper({ isOpen, onClose, onSelect, buttonRef }: EmojiPickerProps) {
  const { theme = 'auto' } = useTheme()

  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      // Don't close if clicking the button that opens the picker
      if (buttonRef?.current?.contains(target)) {
        return
      }

      // Close if clicking outside both the picker and the button
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen, onClose, buttonRef])

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onSelect(emojiData.emoji)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div ref={pickerRef} className={cn('absolute right-0 bottom-full z-50 mb-3')}>
      <EmojiPicker
        onEmojiClick={handleEmojiClick}
        width={320}
        height={350}
        previewConfig={{ showPreview: false }}
        skinTonesDisabled
        lazyLoadEmojis
        emojiStyle={EmojiStyle.NATIVE}
        theme={theme as Theme}
      />
    </div>
  )
}

export { EmojiPickerWrapper as EmojiPicker }
