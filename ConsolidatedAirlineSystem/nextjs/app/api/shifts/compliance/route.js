export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { getShifts, getEmployees, safeEmployee } from '@/lib/store'
import { checkAllCompliance } from '@/lib/compliance'

export async function GET(request) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager', 'Admin'].includes(session.role)) return forbidden()

  const { searchParams } = new URL(request.url)
  // Admin can filter by airport; manager is scoped to their own airport automatically
  const airportFilter = session.role === 'Admin'
    ? (searchParams.get('airport') || null)
    : (session.airportId || null)

  try {
    const [allShifts, employees] = await Promise.all([getShifts(), getEmployees()])

    let schedulable = employees.filter(e => ['Staff', 'Agent'].includes(e.role))
    if (airportFilter) schedulable = schedulable.filter(e => e.airport_id === airportFilter)

    const userIds      = new Set(schedulable.map(e => e.id))
    const scopedShifts = allShifts.filter(s => userIds.has(s.userId))

    const users  = schedulable.map(safeEmployee)
    const report = checkAllCompliance(scopedShifts, users)
    const rows   = Object.values(report.byUser)
      .sort((a, b) => b.criticalCount - a.criticalCount || b.warningCount - a.warningCount)

    return NextResponse.json({ summary: report.summary, users: rows })
  } catch (err) {
    console.error('[compliance GET]', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
