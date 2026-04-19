import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, notFound } from '@/lib/auth'
import { findShiftById, updateShift, getEmployees } from '@/lib/store'
import { enrichShift } from '../my/route'

export async function PUT(request, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager','Admin'].includes(session.role)) return forbidden()

  const shift = await findShiftById(params.id)
  if (!shift) return notFound('Shift not found')

  const body    = await request.json()
  const allowed = ['startTime','endTime','location','shiftType','status']
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))

  const [updated, employees] = await Promise.all([updateShift(params.id, updates), getEmployees()])
  const empMap = Object.fromEntries(employees.map(e => [e.id, e]))
  return NextResponse.json(enrichShift(updated, empMap))
}
