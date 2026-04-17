import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { getShifts } from '@/lib/store'
import { enrichShift } from '../my/route'

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager','Admin'].includes(session.role)) return forbidden()

  return NextResponse.json(
    getShifts().sort((a,b) => new Date(a.startTime) - new Date(b.startTime)).map(enrichShift)
  )
}
