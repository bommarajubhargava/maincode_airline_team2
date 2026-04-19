import { NextResponse } from 'next/server'
import { getSession, unauthorized, badRequest } from '@/lib/auth'
import { findFlightRecordById, submitFlightDuty, getFlightDutyLogs } from '@/lib/store'
import { getDutyByKey } from '@/lib/flightDuties'

export async function POST(request, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const flight = await findFlightRecordById(params.flightId)
  if (!flight) return NextResponse.json({ message: 'Flight not found' }, { status: 404 })

  if (flight.status === 'Completed') return NextResponse.json({ message: 'Flight is completed — no further duty submissions allowed' }, { status: 403 })
  if (flight.status === 'Cancelled') return NextResponse.json({ message: 'Flight is cancelled — duties cannot be submitted' }, { status: 403 })

  let body
  try { body = await request.json() } catch { return badRequest('Invalid JSON') }

  const { dutyKey, formData } = body
  if (!dutyKey) return badRequest('dutyKey required')

  const duty = getDutyByKey(flight.flight_type, dutyKey)
  if (!duty) return NextResponse.json({ message: 'Unknown duty key for this flight type' }, { status: 400 })

  try {
    const logs = await submitFlightDuty({
      flightId:    flight.id,
      dutyKey,
      completedBy: session.sub,
      formData:    formData ?? {},
    })
    return NextResponse.json(logs, { status: 201 })
  } catch (err) {
    console.error('[flight duties POST]', err)
    return NextResponse.json({ message: err.message }, { status: 500 })
  }
}

export async function GET(request, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const flight = await findFlightRecordById(params.flightId)
  if (!flight) return NextResponse.json({ message: 'Flight not found' }, { status: 404 })

  const logs = await getFlightDutyLogs(params.flightId)
  return NextResponse.json(logs)
}
