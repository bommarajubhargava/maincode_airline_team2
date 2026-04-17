import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth'
import { getRequests } from '@/lib/store'
import { enrichRequest } from '../route'

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  return NextResponse.json(
    getRequests().filter(r => r.requestingUserId === session.sub).map(enrichRequest)
  )
}
