import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { getShifts } from '@/lib/store'
import { mockUsers, safeUser } from '@/lib/mockUsers'
import { checkUserCompliance, getFatigueHours } from '@/lib/compliance'

/**
 * GET /api/shifts/compliance/[userId]
 *
 * Returns a detailed compliance report for a single user.
 * Managers and Admins only.
 */
export async function GET(req, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager', 'Admin'].includes(session.role)) return forbidden()

  const { userId } = params
  const user = mockUsers.find(u => u.id === userId)
  if (!user) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 })
  }

  try {
    const allShifts  = getShifts()
    const userShifts = allShifts.filter(s => s.userId === userId)
    const violations = checkUserCompliance(userShifts, userId)

    return NextResponse.json({
      user:       safeUser(user),
      violations,
      fatigue28:  +getFatigueHours(userShifts, 28).toFixed(2),
      fatigue14:  +getFatigueHours(userShifts, 14).toFixed(2),
      fatigue7:   +getFatigueHours(userShifts,  7).toFixed(2),
      totalShifts: userShifts.filter(s => s.status !== 'Cancelled').length,
    })
  } catch (err) {
    console.error('[compliance/:userId GET]', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
