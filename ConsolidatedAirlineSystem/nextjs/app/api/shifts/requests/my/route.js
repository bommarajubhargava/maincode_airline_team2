import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth'
import { getRequests } from '@/lib/store'
import { enrichRequest } from '../route'

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  const requests = await getRequests()
  const mine     = requests.filter(r => r.requestingUserId === session.sub)
  return NextResponse.json(await Promise.all(mine.map(enrichRequest)))
}
