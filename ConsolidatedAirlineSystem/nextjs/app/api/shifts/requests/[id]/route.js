import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, notFound } from '@/lib/auth'
import { findRequestById, deleteRequest } from '@/lib/store'

export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const req = findRequestById(params.id)
  if (!req) return notFound('Request not found')

  // Staff can only delete their own requests; managers can delete any
  const isOwner   = req.requestingUserId === session.sub
  const isManager = ['Manager','Admin'].includes(session.role)
  if (!isOwner && !isManager) return forbidden()

  deleteRequest(params.id)
  return NextResponse.json({ message: 'Request deleted' })
}
