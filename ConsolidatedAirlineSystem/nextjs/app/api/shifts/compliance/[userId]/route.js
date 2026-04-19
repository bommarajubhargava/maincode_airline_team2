import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { getShifts, findEmployeeById, safeEmployee } from '@/lib/store'
import { checkUserCompliance, getFatigueHours } from '@/lib/compliance'

export async function GET(req, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager', 'Admin'].includes(session.role)) return forbidden()

  const { userId } = params
  const emp = await findEmployeeById(userId)
  if (!emp) return NextResponse.json({ message: 'User not found' }, { status: 404 })

  try {
    const allShifts  = await getShifts()
    const userShifts = allShifts.filter(s => s.userId === userId)
    const violations = checkUserCompliance(userShifts, userId)

    return NextResponse.json({
      user:        safeEmployee(emp),
      violations,
      fatigue28:   +getFatigueHours(userShifts, 28).toFixed(2),
      fatigue14:   +getFatigueHours(userShifts, 14).toFixed(2),
      fatigue7:    +getFatigueHours(userShifts,  7).toFixed(2),
      totalShifts: userShifts.filter(s => s.status !== 'Cancelled').length,
    })
  } catch (err) {
    console.error('[compliance/:userId GET]', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
