import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, badRequest } from '@/lib/auth'
import { addRequest } from '@/lib/store'

export async function POST(request) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Staff','Agent'].includes(session.role)) return forbidden()

  const body = await request.json()
  const { shiftId, requestType, reason } = body
  if (!shiftId || !requestType || !reason?.trim())
    return badRequest('shiftId, requestType, and reason are required')

  const req = await addRequest({
    requestingUserId: session.sub,
    shiftId, requestType,
    reason: reason.trim(),
    targetUserId:      body.targetUserId      ?? null,
    targetShiftId:     body.targetShiftId     ?? null,
    proposedStartTime: body.proposedStartTime ?? null,
    proposedEndTime:   body.proposedEndTime   ?? null,
  })

  return NextResponse.json(req, { status: 201 })
}
