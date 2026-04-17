import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { findUserById, safeUser } from '@/lib/mockUsers'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ user: null })
  const user = findUserById(session.sub)
  if (!user) return NextResponse.json({ user: null })
  return NextResponse.json({ user: safeUser(user) })
}
