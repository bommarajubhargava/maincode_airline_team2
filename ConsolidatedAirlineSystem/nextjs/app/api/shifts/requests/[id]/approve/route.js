import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, notFound, badRequest } from '@/lib/auth'
import { findRequestById, updateRequest, findShiftById, updateShift } from '@/lib/store'
import { enrichRequest } from '../../../requests/route'

export async function PUT(request, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager','Admin'].includes(session.role)) return forbidden()

  const req = await findRequestById(params.id)
  if (!req) return notFound('Request not found')
  if (req.status !== 'Pending') return badRequest('Request is not pending')

  const { managerComment = '' } = await request.json()

  const shift = await findShiftById(req.shiftId)
  if (shift) {
    if (req.requestType === 'Cancellation') {
      await updateShift(shift.id, { status: 'Cancelled' })
    } else if (req.requestType === 'Change' && req.proposedStartTime) {
      await updateShift(shift.id, { startTime: req.proposedStartTime, endTime: req.proposedEndTime ?? shift.endTime })
    } else if (req.requestType === 'Swap' && req.targetShiftId) {
      const target = await findShiftById(req.targetShiftId)
      if (target) {
        await updateShift(shift.id,  { userId: target.userId, status: 'Swapped' })
        await updateShift(target.id, { userId: shift.userId,  status: 'Swapped' })
      }
    }
  }

  const updated = await updateRequest(params.id, { status: 'Approved', managerComment })
  return NextResponse.json(await enrichRequest(updated))
}
