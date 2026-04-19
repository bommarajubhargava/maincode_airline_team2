export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { getShifts, getEmployees, findEmployeeById } from '@/lib/store'
import { enrichShift } from '../my/route'

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Staff', 'Agent', 'Manager', 'Admin'].includes(session.role)) return forbidden()

  try {
    const [shifts, employees] = await Promise.all([getShifts(), getEmployees()])

    let scopedEmployees = employees
    if (session.role === 'Manager') {
      const self = await findEmployeeById(session.sub)
      const airportId = self?.airport_id ?? session.airportId
      if (airportId) scopedEmployees = employees.filter(e => e.airport_id === airportId)
    }
    if (session.role === 'Staff' || session.role === 'Agent') {
      const self = await findEmployeeById(session.sub)
      const airportId = self?.airport_id ?? session.airportId
      if (airportId) scopedEmployees = employees.filter(e => e.airport_id === airportId)
    }

    const empMap = Object.fromEntries(scopedEmployees.map(e => [e.id, e]))
    const scopedIds = new Set(scopedEmployees.map(e => e.id))
    return NextResponse.json(
      shifts
        .filter(s => scopedIds.has(s.userId))
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
        .map(s => enrichShift(s, empMap))
    )
  } catch (err) {
    console.error('[shifts/all GET]', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
