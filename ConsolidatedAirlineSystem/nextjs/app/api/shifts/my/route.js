import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth'
import { getShifts, getEmployees } from '@/lib/store'

export function enrichShift(s, empMap = {}) {
  const emp = empMap[s.userId]
  return { ...s, userName: emp?.name ?? '', employeeId: emp?.employee_id ?? '', department: emp?.department ?? '' }
}

export async function GET(request) {
  const session = await getSession()
  if (!session) return unauthorized()

  try {
    const days = Number(new URL(request.url).searchParams.get('days') || 30)
    const from = new Date(); from.setHours(0, 0, 0, 0)
    const to   = new Date(from); to.setDate(from.getDate() + days)

    const [all, employees] = await Promise.all([getShifts(), getEmployees()])
    const empMap = Object.fromEntries(employees.map(e => [e.id, e]))
    const shifts = all
      .filter(s => s.userId === session.sub && new Date(s.startTime) >= from && new Date(s.startTime) < to)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
      .map(s => enrichShift(s, empMap))

    return NextResponse.json(shifts)
  } catch (err) {
    console.error('[shifts/my GET]', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
