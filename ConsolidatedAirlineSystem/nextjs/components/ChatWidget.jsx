'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { chatService } from '@/lib/api'

const POLL_INTERVAL = 5000

const CSS = [
  '.cw-wrap{position:fixed;bottom:16px;right:16px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:8px}',
  '.cw-window{width:420px;height:520px;display:flex;border-radius:14px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.4)}',
  '.cw-sidebar{width:155px;background-color:#0f172a!important;display:flex;flex-direction:column;flex-shrink:0}',
  '.cw-side-head{padding:12px 14px 10px;border-bottom:1px solid #334155;background-color:#0f172a!important}',
  '.cw-side-title{color:#ffffff!important;font-weight:700;font-size:13px;margin:0}',
  '.cw-side-name{color:#64748b!important;font-size:11px;margin:2px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.cw-search-wrap{padding:8px 10px;border-bottom:1px solid #334155;background-color:#0f172a!important}',
  '.cw-search{display:block!important;width:100%!important;box-sizing:border-box!important;background-color:#ffffff!important;color:#1e293b!important;font-size:12px!important;padding:6px 10px!important;border-radius:8px!important;border:2px solid #3b82f6!important;outline:none!important}',
  '.cw-list{flex:1;overflow-y:auto;background-color:#0f172a!important}',
  '.cw-label{display:block!important;color:#475569!important;font-size:10px!important;font-weight:700!important;padding:8px 14px 4px!important;text-transform:uppercase!important;letter-spacing:1px!important;background-color:#0f172a!important}',
  '.cw-item{width:100%!important;text-align:left!important;border:none!important;cursor:pointer!important;padding:7px 14px!important;font-size:12px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:4px!important;background-color:#0f172a!important;color:#94a3b8!important}',
  '.cw-item.active{background-color:#2563eb!important;color:#ffffff!important;font-weight:600!important}',
  '.cw-item.unread{background-color:#1e3a5f!important;color:#93c5fd!important;font-weight:700!important}',
  '.cw-badge{background-color:#ef4444!important;color:#fff!important;font-size:10px!important;font-weight:700!important;border-radius:999px!important;padding:1px 5px!important;min-width:16px!important;text-align:center!important;flex-shrink:0!important}',
  '.cw-msgs{flex:1;display:flex;flex-direction:column;background-color:#1e293b!important;min-width:0}',
  '.cw-msg-head{padding:10px 14px;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;background-color:#0f172a!important}',
  '.cw-msg-title{font-size:13px;font-weight:600;color:#f1f5f9!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.cw-close{background:none!important;border:none!important;cursor:pointer!important;color:#64748b!important;font-size:18px;line-height:1;padding:0;margin-left:8px;flex-shrink:0}',
  '.cw-msg-list{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:8px;background-color:#1e293b!important}',
  '.cw-empty{color:#475569!important;font-size:12px;text-align:center;margin-top:20px}',
  '.cw-sender{font-size:11px;color:#64748b!important;margin-bottom:3px}',
  '.cw-bubble-me{max-width:75%;padding:7px 12px;font-size:13px;background-color:#2563eb!important;color:#ffffff!important;border-radius:16px 16px 4px 16px}',
  '.cw-bubble-them{max-width:75%;padding:7px 12px;font-size:13px;background-color:#334155!important;color:#e2e8f0!important;border-radius:16px 16px 16px 4px}',
  '.cw-time{font-size:10px;color:#475569!important;margin-top:3px}',
  '.cw-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #334155;flex-shrink:0;background-color:#0f172a!important}',
  '.cw-input{flex:1;font-size:12px;padding:7px 12px;border-radius:20px;border:1px solid #334155!important;background-color:#1e293b!important;color:#f1f5f9!important;outline:none}',
  '.cw-send{background-color:#2563eb!important;color:#fff!important;border:none!important;border-radius:20px;padding:7px 14px;cursor:pointer;font-size:13px}',
  '.cw-send:disabled{background-color:#1e3a5f!important;cursor:default}',
  '.cw-fab{background-color:#2563eb!important;color:#fff!important;border:none!important;border-radius:50%;width:50px;height:50px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 20px rgba(37,99,235,.5);font-size:22px;position:relative}',
  '.cw-fab-badge{position:absolute;top:-4px;right:-4px;background-color:#ef4444!important;color:#fff!important;font-size:10px;font-weight:700;border-radius:999px;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;padding:0 4px}',
].join('\n')

export default function ChatWidget() {
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
    chatService.getConversations().then(d => setConversations(d)).catch(() => {})
  }, [user])

  useEffect(() => {
    if (!open || activeChat || !conversations.channels.length) return
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
    const all = [
      ...(conversations.channels || []).map(c => ({ type: 'channel', id: c.id })),
      ...(conversations.peers || []).map(p => ({ type: 'direct', id: p.id })),
    ]
    if (!all.length) return
    const poll = async () => {
      const upd = {}
      await Promise.all(all.map(async chat => {
        try {
          const msgs = await chatService.getMessages(chat.type, chat.id)
          const k = ckey(chat.type, chat.id)
          const seen = lastSeenRef.current[k]
          const n = msgs.filter(m => m.senderId !== user.id && (!seen || m.createdAt > seen)).length
          if (n > 0) upd[k] = n
        } catch {}
      }))
      if (Object.keys(upd).length) setUnreadKeys(prev => ({ ...prev, ...upd }))
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
    const text = input.trim()
    const tempId = 'tmp-' + Date.now()
    const tempMsg = {
      id: tempId,
      senderId: user.id,
      senderName: user.name,
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])
    setInput('')
    try {
      const dto = activeChat.type === 'channel'
        ? { type: 'channel', channelId: activeChat.id, content: text }
        : { type: 'direct', recipientId: activeChat.id, content: text }
      const msg = await chatService.sendMessage(dto)
      setMessages(prev => prev.map(m => m.id === tempId ? msg : m))
      lastSeenRef.current[ckey(activeChat.type, activeChat.id)] = msg.createdAt
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setInput(text)
    }
    setSending(false)
  }

  const totalUnread = Object.values(unreadKeys).reduce((s, n) => s + (n || 0), 0)
  const fmt = iso => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const q = search.toLowerCase()
  const filtCh = (conversations.channels || []).filter(c => !q || c.id.toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q))
  const filtPeers = (conversations.peers || []).filter(p => !q || (p.name || '').toLowerCase().includes(q))

  if (!user) return null

  return (
    <div className="cw-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {open && (
        <div className="cw-window">
          <div className="cw-sidebar">
            <div className="cw-side-head">
              <p className="cw-side-title">Team Chat</p>
              <p className="cw-side-name">{user.name}</p>
            </div>
            <div className="cw-search-wrap">
              <input className="cw-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people..." />
            </div>
            <div className="cw-list">
              <span className="cw-label">Channels</span>
              {filtCh.map(ch => {
                const k = ckey('channel', ch.id)
                const active = activeChat?.id === ch.id && activeChat?.type === 'channel'
                const unread = (unreadKeys[k] || 0) > 0
                return (
                  <button key={ch.id} className={'cw-item' + (active ? ' active' : unread ? ' unread' : '')}
                    onClick={() => setActiveChat({ type: 'channel', id: ch.id, name: '#' + ch.id + ' · ' + ch.name })}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}># {ch.id}</span>
                    {unread && !active && <span className="cw-badge">{unreadKeys[k]}</span>}
                  </button>
                )
              })}
              <span className="cw-label">Direct</span>
              {filtPeers.map(peer => {
                const k = ckey('direct', peer.id)
                const active = activeChat?.id === peer.id && activeChat?.type === 'direct'
                const unread = (unreadKeys[k] || 0) > 0
                return (
                  <button key={peer.id} className={'cw-item' + (active ? ' active' : unread ? ' unread' : '')}
                    onClick={() => setActiveChat({ type: 'direct', id: peer.id, name: peer.name })}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{peer.name}</span>
                    {unread && !active && <span className="cw-badge">{unreadKeys[k]}</span>}
                  </button>
                )
              })}
              {q && !filtCh.length && !filtPeers.length && <p className="cw-empty">No results</p>}
            </div>
          </div>
          <div className="cw-msgs">
            <div className="cw-msg-head">
              <span className="cw-msg-title">{activeChat ? activeChat.name : 'Select a chat'}</span>
              <button className="cw-close" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="cw-msg-list">
              {!messages.length && <p className="cw-empty">No messages yet 👋</p>}
              {messages.map((msg, i) => {
                const mine = msg.senderId === user.id
                const showName = !mine && (i === 0 || messages[i - 1].senderId !== msg.senderId)
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                    {showName && <div className="cw-sender">{msg.senderName}</div>}
                    <div className={mine ? 'cw-bubble-me' : 'cw-bubble-them'}>{msg.content}</div>
                    <div className="cw-time">{fmt(msg.createdAt)}</div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
            <form className="cw-form" onSubmit={handleSend}>
              <input className="cw-input" value={input} onChange={e => setInput(e.target.value)}
                placeholder={activeChat ? 'Type a message...' : 'Select a chat first'} disabled={!activeChat} />
              <button className="cw-send" type="submit" disabled={!input.trim() || !activeChat || sending}>
                {sending ? '…' : '↑'}
              </button>
            </form>
          </div>
        </div>
      )}
      <button className="cw-fab" onClick={() => { setOpen(o => !o); setSearch('') }}>
        {open ? '✕' : '💬'}
        {!open && totalUnread > 0 && <span className="cw-fab-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>}
      </button>
    </div>
  )
}
