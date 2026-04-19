'use client'
import { useAuth } from '@/context/AuthContext'
import ChatPanel from '@/components/ChatPanel'

export default function ChatMount() {
  const { user } = useAuth()
  if (!user) return null
  return <ChatPanel />
}
