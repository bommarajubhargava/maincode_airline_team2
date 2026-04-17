import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, notFound, badRequest } from '@/lib/auth'
import { findRequestById, updateRequest, findShiftById, updateShift } from '@/lib/store'
import { enrichRequest } from '../../../requests/route'

export async function PUT(request, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager','Admin'].includes(session.role)) return forbidden()

  const req = findRequestById(params.id)
  if (!req) return notFound('Request not found')
  if (req.status !== 'Pending') return badRequest('Request is not pending')

  const { managerComment = '' } = await request.json()

  const shift = findShiftById(req.shiftId)
  if (shift) {
    if (req.requestType === 'Cancellation') {
      updateShift(shift.id, { status: 'Cancelled' })
    } else if (req.requestType === 'Change' && req.proposedStartTime) {
      updateShift(shift.id, { startTime: req.proposedStartTime, endTime: req.proposedEndTime ?? shift.endTime })
    } else if (req.requestType === 'Swap' && req.targetShiftId) {
      const target = findShiftById(req.targetShiftId)
      if (target) {
        updateShift(shift.id,  { userId: target.userId, status: 'Swapped' })
        updateShift(target.id, { userId: shift.userId,  status: 'Swapped' })
      }
    }
  }

  const updated = updateRequest(params.id, { status: 'Approved', managerComment })
  return NextResponse.json(enrichRequest(updated))
}
