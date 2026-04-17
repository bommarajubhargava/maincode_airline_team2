import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { getShifts, getRosters, createRoster, saveRosterShifts, findRosterById, getRosterShifts } from '@/lib/store'
import { mockUsers, safeUser } from '@/lib/mockUsers'
import { generateDraftRoster, checkRosterConflicts } from '@/lib/scheduler'

const schedulable = () => mockUsers.filter(u => ['Staff', 'Agent'].includes(u.role)).map(safeUser)

/**
 * GET /api/scheduling/roster
 * Returns all saved rosters (Draft + Published) with shift counts.
 */
export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager', 'Admin'].includes(session.role)) return forbidden()

  const rosters = getRosters().map(r => ({
    ...r,
    shiftCount: getRosterShifts(r.id).length,
  }))

  return NextResponse.json(rosters)
}

/**
 * POST /api/scheduling/roster
 * Body: { name, startDate, endDate, preview? }
 *
 * preview = true  → return draft + conflicts without persisting
 * preview = false → generate, save as Draft, return roster with conflicts
 */
export async function POST(req) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager', 'Admin'].includes(session.role)) return forbidden()

  const body = await req.json()
  const { name, startDate, endDate, preview = false } = body

  if (!startDate || !endDate) {
    return NextResponse.json({ message: 'startDate and endDate are required' }, { status: 400 })
  }
  if (new Date(startDate) > new Date(endDate)) {
    return NextResponse.json({ message: 'startDate must be before endDate' }, { status: 400 })
  }

  const existingShifts = getShifts()
  const users          = schedulable()

  let draftShifts, conflicts
  try {
    draftShifts = generateDraftRoster({ startDate, endDate }, existingShifts, users)
    conflicts   = checkRosterConflicts(draftShifts, existingShifts, users, startDate, endDate)
  } catch (err) {
    console.error('[scheduling POST] generation error', err)
    return NextResponse.json({ message: `Roster generation failed: ${err.message}` }, { status: 500 })
  }

  const criticalCount = conflicts.filter(c => c.severity === 'critical').length
  const warningCount  = conflicts.filter(c => c.severity === 'warning').length

  // Preview mode: return draft without saving
  if (preview) {
    return NextResponse.json({
      preview:   true,
      startDate, endDate,
      shifts:    draftShifts,
      conflicts,
      summary: {
        totalShifts:    draftShifts.length,
        criticalCount,
        warningCount,
        usersAssigned:  [...new Set(draftShifts.map(s => s.userId))].length,
      },
    })
  }

  // Save mode: persist roster + shifts
  if (!name?.trim()) {
    return NextResponse.json({ message: 'Roster name is required' }, { status: 400 })
  }

  try {
    const roster = createRoster({ name: name.trim(), startDate, endDate, createdBy: session.sub ?? session.id ?? 'unknown' })
    saveRosterShifts(roster.id, draftShifts)

    return NextResponse.json({
      roster: findRosterById(roster.id),
      shifts: getRosterShifts(roster.id),
      conflicts,
      summary: {
        totalShifts:   draftShifts.length,
        criticalCount,
        warningCount,
        usersAssigned: [...new Set(draftShifts.map(s => s.userId))].length,
      },
    }, { status: 201 })
  } catch (err) {
    console.error('[scheduling POST] save error', err)
    return NextResponse.json({ message: `Failed to save roster: ${err.message}` }, { status: 500 })
  }
}
