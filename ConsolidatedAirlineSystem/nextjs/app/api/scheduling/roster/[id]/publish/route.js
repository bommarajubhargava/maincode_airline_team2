import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { getShifts, findRosterById, getRosterShifts, publishRoster } from '@/lib/store'
import { mockUsers, safeUser } from '@/lib/mockUsers'
import { checkRosterConflicts } from '@/lib/scheduler'

/**
 * POST /api/scheduling/roster/[id]/publish
 *
 * Copies all roster_shifts into the live shifts table (status = 'Scheduled').
 * Blocked if there are any unresolved critical conflicts.
 * Warnings are noted but do not block publishing.
 */
export async function POST(req, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager', 'Admin'].includes(session.role)) return forbidden()

  const roster = findRosterById(params.id)
  if (!roster) return NextResponse.json({ message: 'Roster not found' }, { status: 404 })
  if (roster.status === 'Published') {
    return NextResponse.json({ message: 'Roster already published' }, { status: 409 })
  }

  const rosterShifts   = getRosterShifts(roster.id)
  const existingShifts = getShifts()
  const users          = mockUsers.filter(u => ['Staff', 'Agent'].includes(u.role)).map(safeUser)
  const conflicts      = checkRosterConflicts(rosterShifts, existingShifts, users, roster.startDate, roster.endDate)

  const criticals = conflicts.filter(c => c.severity === 'critical')

  // Read optional override flag (manager explicitly acknowledges critical issues)
  let body = {}
  try { body = await req.json() } catch {}
  const { force = false } = body

  if (criticals.length && !force) {
    return NextResponse.json({
      message:  `Cannot publish: ${criticals.length} critical conflict(s) must be resolved first. Pass { force: true } to override.`,
      conflicts: criticals,
    }, { status: 422 })
  }

  const published = publishRoster(roster.id)
  return NextResponse.json({ roster: published, publishedShifts: rosterShifts.length })
}
