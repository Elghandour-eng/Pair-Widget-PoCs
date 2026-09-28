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

  // Pinned inside the panel viewport, not hung off the button: a 320px pop
  // anchored to a right-side button used to overflow the panel edge and get
  // clipped by its overflow.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 400
  const vh = typeof window !== 'undefined' ? window.innerHeight : 700
  return (
    <div ref={pickerRef} className={cn('fixed z-50')} style={{ insetInline: 12, bottom: 92 }}>
      <EmojiPicker
        onEmojiClick={handleEmojiClick}
        width={Math.min(320, vw - 24)}
        height={Math.min(350, vh - 200)}
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
