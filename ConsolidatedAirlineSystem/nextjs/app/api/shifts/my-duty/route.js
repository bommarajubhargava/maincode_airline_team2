export const dynamic = 'force-dynamic'
import { getSession, unauthorized } from '@/lib/auth'
import { getTodayDuties } from '@/lib/store'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  const duties = await getTodayDuties(session.sub)
  return NextResponse.json({ duties })
}
