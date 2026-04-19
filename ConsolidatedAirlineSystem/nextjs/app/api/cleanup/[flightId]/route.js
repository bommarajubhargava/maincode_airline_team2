import { getSession, unauthorized, notFound, badRequest } from '@/lib/auth'
import { findFlightById, CLEANUP_TASKS } from '@/lib/flightData'
import { getCleanupLog, addCleanupLog } from '@/lib/store'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const flight = findFlightById(params.flightId)
  if (!flight) return notFound()

  return NextResponse.json({
    flight,
    tasks: CLEANUP_TASKS,
    log: (await getCleanupLog(flight.id)) ?? null,
  })
}

export async function POST(request, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const flight = findFlightById(params.flightId)
  if (!flight) return notFound()

  let tasks
  try {
    const body = await request.json()
    tasks = body.tasks
  } catch {
    return badRequest('Invalid request body')
  }

  if (tasks === undefined || tasks === null) return badRequest('tasks required')

  try {
    const log = await addCleanupLog({ flightId: flight.id, agentId: session.sub, tasks })
    return NextResponse.json(log, { status: 201 })
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500 })
  }
}
