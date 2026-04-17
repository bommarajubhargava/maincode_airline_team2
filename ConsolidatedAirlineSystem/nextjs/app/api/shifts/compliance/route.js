import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { getShifts } from '@/lib/store'
import { mockUsers, safeUser } from '@/lib/mockUsers'
import { checkAllCompliance } from '@/lib/compliance'

/**
 * GET /api/shifts/compliance
 *
 * Returns a full compliance report for all schedulable staff.
 * Managers and Admins only.
 */
export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager', 'Admin'].includes(session.role)) return forbidden()

  try {
    const allShifts = getShifts()

    // Only check schedulable users (Staff + Agent — exclude Managers/Admin)
    const schedulable = mockUsers.filter(u => ['Staff', 'Agent'].includes(u.role))
    const users = schedulable.map(safeUser)

    const report = checkAllCompliance(allShifts, users)

    // Shape the response: array of per-user summaries sorted by most critical first
    const rows = Object.values(report.byUser)
      .sort((a, b) => b.criticalCount - a.criticalCount || b.warningCount - a.warningCount)

    return NextResponse.json({
      summary: report.summary,
      users:   rows,
    })
  } catch (err) {
    console.error('[compliance GET]', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
