export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { getShifts, findRosterById, getRosterShifts, publishRoster, getEmployees, safeEmployee } from '@/lib/store'
import { checkRosterConflicts } from '@/lib/scheduler'

export async function POST(req, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager', 'Admin'].includes(session.role)) return forbidden()

  const roster = await findRosterById(params.id)
  if (!roster) return NextResponse.json({ message: 'Roster not found' }, { status: 404 })
  if (roster.status === 'Published') {
    return NextResponse.json({ message: 'Roster already published' }, { status: 409 })
  }

  const [rosterShifts, existingShifts, allEmployees] = await Promise.all([
    getRosterShifts(roster.id),
    getShifts(),
    getEmployees(),
  ])
  const users     = allEmployees.filter(e => ['Staff', 'Agent'].includes(e.role)).map(safeEmployee)
  const conflicts = checkRosterConflicts(rosterShifts, existingShifts, users, roster.startDate, roster.endDate)
  const criticals = conflicts.filter(c => c.severity === 'critical')

  let body = {}
  try { body = await req.json() } catch {}
  const { force = false } = body

  if (criticals.length && !force) {
    return NextResponse.json({
      message:   `Cannot publish: ${criticals.length} critical conflict(s) must be resolved first. Pass { force: true } to override.`,
      conflicts: criticals,
    }, { status: 422 })
  }

  const published = await publishRoster(roster.id)
  return NextResponse.json({ roster: published, publishedShifts: rosterShifts.length })
}
