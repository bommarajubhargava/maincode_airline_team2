export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { getEmployees, safeEmployee, findEmployeeById } from '@/lib/store'

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager', 'Admin'].includes(session.role)) return forbidden()

  const employees = await getEmployees()
  let safe = employees.map(safeEmployee)

  if (session.role === 'Manager') {
    // Look up the manager's own record from DB so airport scoping works
    // even if their JWT pre-dates the airportId claim
    const self = await findEmployeeById(session.sub)
    const airportId = self?.airport_id ?? session.airportId
    if (airportId) {
      safe = safe.filter(e => e.airportId === airportId)
    }
  }

  return NextResponse.json(safe)
}
