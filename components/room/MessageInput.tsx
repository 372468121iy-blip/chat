'use client'

import { useState } from 'react'

type Props = { onSend: (content: string) => Promise<void>; disabled?: boolean }

export function MessageInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    const content = value.trim()
    if (!content || sending || disabled) return
    setSending(true)
    await onSend(content)
    setValue('')
    setSending(false)
  }

  return (
    <div className="border-t border-[#3a3a5c] bg-[#0A0A0F] px-4 py-3">
      {disabled && (
        <p className="mb-2 text-center text-xs text-red-400">You are muted in this room.</p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          rows={1}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          disabled={disabled || sending}
          placeholder="Type a message… (Enter to send)"
          className="flex-1 resize-none rounded-xl bg-[#2D2D44] border border-[#3a3a5c] px-4 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4b5563] outline-none focus:border-[#00F5FF] disabled:opacity-40 max-h-32"
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || sending || disabled}
          className="flex-shrink-0 h-10 w-10 rounded-xl bg-[#7C4DFF] text-white disabled:opacity-40 hover:bg-[#6B3FE0] transition-colors flex items-center justify-center"
        >
          ➤
        </button>
      </div>
    </div>
  )
}
