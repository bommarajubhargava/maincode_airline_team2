import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden, badRequest } from '@/lib/auth'
import { assignShifts } from '@/lib/store'

export async function POST(request) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager', 'Admin'].includes(session.role)) return forbidden()

  let body
  try { body = await request.json() } catch { return badRequest('Invalid JSON') }

  const { employeeIds, shiftTypeId, dates, airportId, duty } = body
  if (!employeeIds?.length)  return badRequest('employeeIds required')
  if (!shiftTypeId)          return badRequest('shiftTypeId required')
  if (!dates?.length)        return badRequest('dates required')

  try {
    const result = await assignShifts({ employeeIds, shiftTypeId, dates, airportId, duty })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('[manager/assign POST]', err)
    return NextResponse.json({ message: err.message }, { status: 500 })
  }
}
