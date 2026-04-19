import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { getShifts, getRosters, createRoster, saveRosterShifts, findRosterById, getRosterShifts, getEmployees, safeEmployee } from '@/lib/store'
import { generateDraftRoster, checkRosterConflicts } from '@/lib/scheduler'

const schedulable = async () => {
  const employees = await getEmployees()
  return employees.filter(e => ['Staff', 'Agent'].includes(e.role)).map(safeEmployee)
}

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager', 'Admin'].includes(session.role)) return forbidden()

  const rosters = await getRosters()
  const withCounts = await Promise.all(
    rosters.map(async r => ({ ...r, shiftCount: (await getRosterShifts(r.id)).length }))
  )
  return NextResponse.json(withCounts)
}

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

  const [existingShifts, users] = await Promise.all([getShifts(), schedulable()])

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

  if (preview) {
    return NextResponse.json({
      preview: true,
      startDate, endDate,
      shifts:  draftShifts,
      conflicts,
      summary: {
        totalShifts:   draftShifts.length,
        criticalCount,
        warningCount,
        usersAssigned: [...new Set(draftShifts.map(s => s.userId))].length,
      },
    })
  }

  if (!name?.trim()) {
    return NextResponse.json({ message: 'Roster name is required' }, { status: 400 })
  }

  try {
    const roster = await createRoster({ name: name.trim(), startDate, endDate, createdBy: session.sub ?? session.id ?? 'unknown' })
    await saveRosterShifts(roster.id, draftShifts)

    return NextResponse.json({
      roster:   await findRosterById(roster.id),
      shifts:   await getRosterShifts(roster.id),
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
