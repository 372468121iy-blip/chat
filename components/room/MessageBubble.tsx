import type { Message } from '@/types'

type Props = { message: Message; isOwn: boolean }

export function MessageBubble({ message, isOwn }: Props) {
  const nickname = message.users?.nickname ?? 'Deleted User'
  const avatar = message.users?.avatar ?? '👤'
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`flex gap-2.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className="flex-shrink-0 text-xl leading-none mt-1">{avatar}</div>
      <div className={`flex max-w-[75%] flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6b7280]">{isOwn ? 'You' : nickname}</span>
          <span className="text-[10px] text-[#4b5563]">{time}</span>
        </div>
        <div className={`rounded-2xl px-4 py-2 text-sm leading-relaxed break-words ${
          isOwn
            ? 'bg-[#7C4DFF] text-white rounded-tr-sm'
            : 'bg-[#2D2D44] border border-[#3a3a5c] text-[#e2e8f0] rounded-tl-sm'
        }`}>
          {message.content}
        </div>
      </div>
    </div>
  )
}
