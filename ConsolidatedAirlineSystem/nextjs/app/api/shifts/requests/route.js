export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { getRequests, findShiftById, findEmployeeById, getEmployees } from '@/lib/store'
import { enrichShift } from '../my/route'

export async function enrichRequest(r, empMap = {}) {
  const reqEmp   = empMap[r.requestingUserId] ?? (await findEmployeeById(r.requestingUserId))
  const tgtEmp   = r.targetUserId ? (empMap[r.targetUserId] ?? await findEmployeeById(r.targetUserId)) : null
  const shift    = await findShiftById(r.shiftId)
  const tgtShift = r.targetShiftId ? await findShiftById(r.targetShiftId) : null
  return {
    ...r,
    requestingUserName: reqEmp?.name ?? '',
    targetUserName:     tgtEmp?.name ?? null,
    shift:       shift    ? enrichShift(shift,    empMap) : null,
    targetShift: tgtShift ? enrichShift(tgtShift, empMap) : null,
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager','Admin'].includes(session.role)) return forbidden()

  try {
    const [requests, employees] = await Promise.all([getRequests(), getEmployees()])
    const empMap = Object.fromEntries(employees.map(e => [e.id, e]))
    return NextResponse.json(await Promise.all(requests.map(r => enrichRequest(r, empMap))))
  } catch (err) {
    console.error('[shifts/requests GET]', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
