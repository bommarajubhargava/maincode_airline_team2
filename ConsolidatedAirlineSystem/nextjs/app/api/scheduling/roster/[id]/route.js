import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { getShifts, findRosterById, getRosterShifts, deleteRoster } from '@/lib/store'
import { mockUsers, safeUser } from '@/lib/mockUsers'
import { checkRosterConflicts } from '@/lib/scheduler'

/**
 * GET /api/scheduling/roster/[id]
 * Returns a saved roster with its shifts, conflicts, and user details.
 */
export async function GET(req, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager', 'Admin'].includes(session.role)) return forbidden()

  const roster = findRosterById(params.id)
  if (!roster) return NextResponse.json({ message: 'Roster not found' }, { status: 404 })

  const rosterShifts   = getRosterShifts(roster.id)
  const existingShifts = getShifts()
  const users          = mockUsers.filter(u => ['Staff', 'Agent'].includes(u.role)).map(safeUser)
  const conflicts      = checkRosterConflicts(rosterShifts, existingShifts, users, roster.startDate, roster.endDate)

  // Enrich shifts with user info
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

/**
 * DELETE /api/scheduling/roster/[id]
 * Deletes a Draft roster (Published rosters cannot be deleted).
 */
export async function DELETE(req, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager', 'Admin'].includes(session.role)) return forbidden()

  const roster = findRosterById(params.id)
  if (!roster) return NextResponse.json({ message: 'Roster not found' }, { status: 404 })
  if (roster.status === 'Published') {
    return NextResponse.json({ message: 'Published rosters cannot be deleted' }, { status: 409 })
  }

  deleteRoster(params.id)
  return NextResponse.json({ message: 'Roster deleted' })
}
