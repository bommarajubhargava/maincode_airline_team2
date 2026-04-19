export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { getShifts, findRosterById, getRosterShifts, deleteRoster, getEmployees, safeEmployee } from '@/lib/store'
import { checkRosterConflicts } from '@/lib/scheduler'

export async function GET(req, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager', 'Admin'].includes(session.role)) return forbidden()

  const roster = await findRosterById(params.id)
  if (!roster) return NextResponse.json({ message: 'Roster not found' }, { status: 404 })

  const [rosterShifts, existingShifts, allEmployees] = await Promise.all([
    getRosterShifts(roster.id),
    getShifts(),
    getEmployees(),
  ])
  const users     = allEmployees.filter(e => ['Staff', 'Agent'].includes(e.role)).map(safeEmployee)
  const conflicts = checkRosterConflicts(rosterShifts, existingShifts, users, roster.startDate, roster.endDate)

  const userMap = Object.fromEntries(users.map(u => [u.id, u]))
  const enriched = rosterShifts.map(s => ({
    ...s,
    userName:   userMap[s.userId]?.name ?? s.userId,
    employeeId: userMap[s.userId]?.employeeId ?? '',
    department: userMap[s.userId]?.department ?? '',
  }))

  return NextResponse.json({
    roster,
    shifts:   enriched,
    conflicts,
    summary: {
      totalShifts:   rosterShifts.length,
      criticalCount: conflicts.filter(c => c.severity === 'critical').length,
      warningCount:  conflicts.filter(c => c.severity === 'warning').length,
      usersAssigned: [...new Set(rosterShifts.map(s => s.userId))].length,
    },
  })
}

export async function DELETE(req, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager', 'Admin'].includes(session.role)) return forbidden()

  const roster = await findRosterById(params.id)
  if (!roster) return NextResponse.json({ message: 'Roster not found' }, { status: 404 })
  if (roster.status === 'Published') {
    return NextResponse.json({ message: 'Published rosters cannot be deleted' }, { status: 409 })
  }

  await deleteRoster(params.id)
  return NextResponse.json({ message: 'Roster deleted' })
}
