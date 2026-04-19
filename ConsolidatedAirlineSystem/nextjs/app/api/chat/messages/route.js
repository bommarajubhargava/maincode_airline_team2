export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth'
import { getChannelMessages, getDirectMessages, sendMessage, findEmployeeById } from '@/lib/store'

export async function GET(request) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')       // 'channel' or 'direct'
  const channelId = searchParams.get('channelId')
  const peerId = searchParams.get('peerId')

  try {
    if (type === 'channel' && channelId) {
      const messages = await getChannelMessages(channelId)
      return NextResponse.json(messages)
    }
    if (type === 'direct' && peerId) {
      const messages = await getDirectMessages(session.sub, peerId)
      return NextResponse.json(messages)
    }
    return NextResponse.json([])
  } catch (err) {
    console.error('[chat/messages GET]', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  const session = await getSession()
  if (!session) return unauthorized()

  try {
    const { type, channelId, recipientId, content } = await request.json()
    if (!content?.trim()) return NextResponse.json({ message: 'Content required' }, { status: 400 })

    const self = await findEmployeeById(session.sub)
    const message = await sendMessage({
      senderId: session.sub,
      senderName: self?.name ?? session.name ?? 'Unknown',
      type,
      channelId: channelId ?? null,
      recipientId: recipientId ?? null,
      content: content.trim(),
    })
    return NextResponse.json(message)
  } catch (err) {
    console.error('[chat/messages POST]', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
