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
    <div className="border-t border-[#2d2d4e] bg-[#0f0f1a] px-4 py-3">
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
          className="flex-1 resize-none rounded-xl bg-[#1a1a2e] border border-[#2d2d4e] px-4 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4b5563] outline-none focus:border-[#a78bfa] disabled:opacity-40 max-h-32"
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || sending || disabled}
          className="flex-shrink-0 h-10 w-10 rounded-xl bg-[#7c3aed] text-white disabled:opacity-40 hover:bg-[#6d28d9] transition-colors flex items-center justify-center"
        >
          ➤
        </button>
      </div>
    </div>
  )
}
