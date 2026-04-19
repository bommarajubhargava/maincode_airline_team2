export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth'
import { getShiftTypes } from '@/lib/store'

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  const types = await getShiftTypes()
  return NextResponse.json(types)
}
