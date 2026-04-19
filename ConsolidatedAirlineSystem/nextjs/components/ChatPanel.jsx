'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { chatService } from '@/lib/api'

const POLL_INTERVAL = 5000

export default function ChatPanel() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [conversations, setConversations] = useState({ channels: [], peers: [] })
  const [activeChat, setActiveChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [unreadKeys, setUnreadKeys] = useState({})
  const bottomRef = useRef(null)
  const pollRef = useRef(null)
  const lastSeenRef = useRef({})

  const ckey = (type, id) => `${type}:${id}`

  useEffect(() => {
    if (!user || conversations.channels.length > 0) return
    chatService.getConversations().then(data => setConversations(data)).catch(() => {})
  }, [user])

  useEffect(() => {
    if (!open || activeChat || conversations.channels.length === 0) return
    const ch = conversations.channels[0]
    setActiveChat({ type: 'channel', id: ch.id, name: `#${ch.id} · ${ch.name}` })
  }, [open, conversations])

  const fetchMessages = useCallback(async () => {
    if (!activeChat) return
    try {
      const msgs = await chatService.getMessages(activeChat.type, activeChat.id)
      setMessages(msgs)
      const k = ckey(activeChat.type, activeChat.id)
      lastSeenRef.current[k] = msgs[msgs.length - 1]?.createdAt
      setUnreadKeys(prev => ({ ...prev, [k]: 0 }))
    } catch {}
  }, [activeChat])

  useEffect(() => {
    if (!activeChat) return
    setMessages([])
    fetchMessages()
    clearInterval(pollRef.current)
    pollRef.current = setInterval(fetchMessages, POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [activeChat, fetchMessages])

  useEffect(() => {
    if (open || !user) return
    const allChats = [
      ...(conversations.channels || []).map(c => ({ type: 'channel', id: c.id })),
      ...(conversations.peers || []).map(p => ({ type: 'direct', id: p.id })),
    ]
    if (!allChats.length) return
    const poll = async () => {
      const updates = {}
      await Promise.all(allChats.map(async chat => {
        try {
          const msgs = await chatService.getMessages(chat.type, chat.id)
          const k = ckey(chat.type, chat.id)
          const seen = lastSeenRef.current[k]
          const n = msgs.filter(m => m.senderId !== user.id && (!seen || m.createdAt > seen)).length
          if (n > 0) updates[k] = n
        } catch {}
      }))
      if (Object.keys(updates).length) setUnreadKeys(prev => ({ ...prev, ...updates }))
    }
    poll()
    const t = setInterval(poll, POLL_INTERVAL * 2)
    return () => clearInterval(t)
  }, [open, user, conversations])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || !activeChat || sending) return
    setSending(true)
    try {
      const dto = activeChat.type === 'channel'
        ? { type: 'channel', channelId: activeChat.id, content: input.trim() }
        : { type: 'direct', recipientId: activeChat.id, content: input.trim() }
      const msg = await chatService.sendMessage(dto)
      setMessages(prev => [...prev, msg])
      setInput('')
      const k = ckey(activeChat.type, activeChat.id)
      lastSeenRef.current[k] = msg.createdAt
    } catch {}
    setSending(false)
  }

  const totalUnread = Object.values(unreadKeys).reduce((s, n) => s + (n || 0), 0)
  const fmt = iso => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const q = search.toLowerCase()
  const filtCh = (conversations.channels || []).filter(c => !q || c.id.toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q))
  const filtPeers = (conversations.peers || []).filter(p => !q || (p.name || '').toLowerCase().includes(q))

  if (!user) return null

  return (
    <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>

      {open && (
        <div style={{ width: 420, height: 520, display: 'flex', borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.35)', border: '1px solid #0f172a' }}>

          {/* ── SIDEBAR ── */}
          <div style={{ width: 155, backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #1e293b' }}>
              <div style={{ color: '#ffffff', fontWeight: 700, fontSize: 13, fontFamily: 'sans-serif' }}>Team Chat</div>
              <div style={{ color: '#64748b', fontSize: 11, fontFamily: 'sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{user.name}</div>
            </div>

            {/* Search */}
            <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid #1e293b' }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search people..."
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', backgroundColor: '#ffffff', color: '#1e293b', fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '2px solid #3b82f6', outline: 'none', fontFamily: 'sans-serif' }}
              />
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ color: '#475569', fontSize: 10, fontWeight: 700, padding: '8px 14px 4px', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'sans-serif' }}>Channels</div>
              {filtCh.map(ch => {
                const k = ckey('channel', ch.id)
                const active = activeChat?.id === ch.id && activeChat?.type === 'channel'
                const unread = (unreadKeys[k] || 0) > 0
                return (
                  <button key={ch.id}
                    onClick={() => setActiveChat({ type: 'channel', id: ch.id, name: `#${ch.id} · ${ch.name}` })}
                    style={{ width: '100%', textAlign: 'left', padding: '7px 14px', fontSize: 12, fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: active ? '#2563eb' : unread ? '#1e3a5f' : 'transparent', color: active ? '#fff' : unread ? '#93c5fd' : '#94a3b8', fontWeight: unread ? 700 : 400, border: 'none', cursor: 'pointer' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}># {ch.id}</span>
                    {unread && !active && <span style={{ backgroundColor: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '1px 5px', minWidth: 16, textAlign: 'center' }}>{unreadKeys[k]}</span>}
                  </button>
                )
              })}

              <div style={{ color: '#475569', fontSize: 10, fontWeight: 700, padding: '8px 14px 4px', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'sans-serif', marginTop: 4 }}>Direct</div>
              {filtPeers.map(peer => {
                const k = ckey('direct', peer.id)
                const active = activeChat?.id === peer.id && activeChat?.type === 'direct'
                const unread = (unreadKeys[k] || 0) > 0
                return (
                  <button key={peer.id}
                    onClick={() => setActiveChat({ type: 'direct', id: peer.id, name: peer.name })}
                    style={{ width: '100%', textAlign: 'left', padding: '7px 14px', fontSize: 12, fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, backgroundColor: active ? '#2563eb' : unread ? '#1e3a5f' : 'transparent', color: active ? '#fff' : unread ? '#93c5fd' : '#94a3b8', fontWeight: unread ? 700 : 400, border: 'none', cursor: 'pointer' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{peer.name}</span>
                    {unread && !active && <span style={{ backgroundColor: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '1px 5px', minWidth: 16, textAlign: 'center' }}>{unreadKeys[k]}</span>}
                  </button>
                )
              })}
              {q && !filtCh.length && !filtPeers.length && (
                <div style={{ color: '#475569', fontSize: 12, padding: '10px 14px', fontFamily: 'sans-serif' }}>No results</div>
              )}
            </div>
          </div>

          {/* ── MESSAGES ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#1e293b' }}>
            {/* Header */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', fontFamily: 'sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeChat?.name ?? 'Select a chat'}
              </span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 18, lineHeight: 1, padding: 0, marginLeft: 8 }}>✕</button>
            </div>

            {/* Messages list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {messages.length === 0 && (
                <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', marginTop: 20, fontFamily: 'sans-serif' }}>No messages yet 👋</div>
              )}
              {messages.map((msg, i) => {
                const mine = msg.senderId === user.id
                const showName = !mine && (i === 0 || messages[i - 1]?.senderId !== msg.senderId)
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                    {showName && <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3, fontFamily: 'sans-serif' }}>{msg.senderName}</div>}
                    <div style={{ maxWidth: '75%', padding: '7px 12px', borderRadius: 16, fontSize: 13, fontFamily: 'sans-serif', backgroundColor: mine ? '#2563eb' : '#334155', color: mine ? '#ffffff' : '#e2e8f0', borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4 }}>
                      {msg.content}
                    </div>
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 3, fontFamily: 'sans-serif' }}>{fmt(msg.createdAt)}</div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid #334155', flexShrink: 0 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={activeChat ? 'Type a message...' : 'Select a chat first'}
                disabled={!activeChat}
                style={{ flex: 1, fontSize: 12, padding: '7px 12px', borderRadius: 20, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f1f5f9', outline: 'none', fontFamily: 'sans-serif' }}
              />
              <button type="submit" disabled={!input.trim() || !activeChat || sending}
                style={{ backgroundColor: input.trim() && activeChat ? '#2563eb' : '#1e3a5f', color: '#fff', border: 'none', borderRadius: 20, padding: '7px 14px', cursor: input.trim() && activeChat ? 'pointer' : 'default', fontSize: 13 }}>
                {sending ? '…' : '↑'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => { setOpen(o => !o); setSearch('') }}
        style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '50%', width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 20px rgba(37,99,235,0.5)', fontSize: 22, position: 'relative' }}>
        {open ? '✕' : '💬'}
        {!open && totalUnread > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>
    </div>
  )
}
