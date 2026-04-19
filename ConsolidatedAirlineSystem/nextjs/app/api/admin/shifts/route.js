export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { getAdminShiftsOverview } from '@/lib/store'

export async function GET(request) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.role !== 'Admin') return forbidden()

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)

  try {
    const rows = await getAdminShiftsOverview(date)
    return NextResponse.json(rows)
  } catch (err) {
    console.error('[admin/shifts GET]', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
