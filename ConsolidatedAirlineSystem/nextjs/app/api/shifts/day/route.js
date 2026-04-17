import { getSession, unauthorized } from '@/lib/auth'
import { getShiftsByDate } from '@/lib/store'
import { findUserById } from '@/lib/mockUsers'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  if (!date) return NextResponse.json({ message: 'date param required' }, { status: 400 })

  const shifts = getShiftsByDate(date)
  const enriched = shifts.map(s => {
    const u = findUserById(s.userId)
    return { ...s, userName: u?.name ?? 'Unknown', role: u?.role ?? '', employeeId: u?.employeeId ?? '', department: u?.department ?? '' }
  })

  return NextResponse.json(enriched)
}
