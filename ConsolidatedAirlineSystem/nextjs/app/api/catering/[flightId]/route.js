import { getSession, unauthorized, notFound, badRequest } from '@/lib/auth'
import { findFlightById, getChecklist } from '@/lib/flightData'
import { getCateringLog, addCateringLog } from '@/lib/store'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const flight = findFlightById(params.flightId)
  if (!flight) return notFound()

  return NextResponse.json({
    flight,
    checklist: getChecklist(flight),
    log: (await getCateringLog(flight.id)) ?? null,
  })
}

export async function POST(request, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const flight = findFlightById(params.flightId)
  if (!flight) return notFound()

  const { items } = await request.json()
  if (!items) return badRequest('items required')

  const checklist = getChecklist(flight)
  const shortfall = checklist.filter(c => (items[c.key] ?? 0) < c.required)
  if (shortfall.length > 0) {
    return NextResponse.json(
      { message: 'Insufficient quantities', shortfall: shortfall.map(c => ({ label: c.label, required: c.required, loaded: items[c.key] ?? 0 })) },
      { status: 422 }
    )
  }

  try {
    const log = await addCateringLog({ flightId: flight.id, agentId: session.sub, items })
    return NextResponse.json(log, { status: 201 })
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500 })
  }
}
