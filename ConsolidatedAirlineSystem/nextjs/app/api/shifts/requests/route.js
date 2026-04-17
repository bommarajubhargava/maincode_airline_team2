import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { getRequests } from '@/lib/store'
import { findUserById } from '@/lib/mockUsers'
import { findShiftById } from '@/lib/store'
import { enrichShift } from '../my/route'

export function enrichRequest(r) {
  const reqUser = findUserById(r.requestingUserId)
  const tgtUser = r.targetUserId ? findUserById(r.targetUserId) : null
  const shift    = findShiftById(r.shiftId)
  const tgtShift = r.targetShiftId ? findShiftById(r.targetShiftId) : null
  return {
    ...r,
    requestingUserName: reqUser?.name ?? '',
    targetUserName:     tgtUser?.name ?? null,
    shift:    shift    ? enrichShift(shift)    : null,
    targetShift: tgtShift ? enrichShift(tgtShift) : null,
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager','Admin'].includes(session.role)) return forbidden()

  return NextResponse.json(getRequests().map(enrichRequest))
}
