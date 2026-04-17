import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, notFound, badRequest } from '@/lib/auth'
import { findRequestById, updateRequest } from '@/lib/store'
import { enrichRequest } from '../../../requests/route'

export async function PUT(request, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager','Admin'].includes(session.role)) return forbidden()

  const req = findRequestById(params.id)
  if (!req) return notFound('Request not found')
  if (req.status !== 'Pending') return badRequest('Request is not pending')

  const { managerComment = '' } = await request.json()
  // Status set to 'Cancelled' when manager rejects
  const updated = updateRequest(params.id, { status: 'Cancelled', managerComment })
  return NextResponse.json(enrichRequest(updated))
}
