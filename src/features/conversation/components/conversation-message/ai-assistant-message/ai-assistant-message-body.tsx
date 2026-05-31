import { parseMarkdown } from '@/lib/parseMarkdown'

interface AiAssistantMessageBodyProps {
  content: string
}

export function AiAssistantMessageBody({ content }: AiAssistantMessageBodyProps) {
  return <div className="text-left text-sm leading-relaxed font-normal text-[#1A1A1A]">{parseMarkdown(content)}</div>
}
