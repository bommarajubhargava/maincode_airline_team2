'use client'
import { useState, useEffect } from 'react'
import ChatPanel from './ChatPanel'

export default function ChatWidgetLoader() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return <ChatPanel />
}
