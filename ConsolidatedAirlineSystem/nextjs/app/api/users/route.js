import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { mockUsers, safeUser } from '@/lib/mockUsers'

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager', 'Admin'].includes(session.role)) return forbidden()

  return NextResponse.json(mockUsers.map(safeUser))
}
