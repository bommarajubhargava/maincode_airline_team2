import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import {
  findFlightRecordById, getFlightDutyLogs,
  getEmployeesByShiftDutyAndDate, getUserShiftDutiesForDate,
  updateFlightStatus,
} from '@/lib/store'
import { getDutiesForFlight, DUTY_KEY_TO_SHIFT_DUTY, DUTY_KEY_TO_LOCATION } from '@/lib/flightDuties'

export async function GET(request, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()

  try {
    const flight = await findFlightRecordById(params.flightId)
    if (!flight) return NextResponse.json({ message: 'Flight not found' }, { status: 404 })

    const flightDate    = flight.scheduled_time.slice(0, 10)
    const dutyTemplates = getDutiesForFlight(flight.flight_type)
    const logs          = await getFlightDutyLogs(flight.id)
    const completedKeys = new Set(logs.map(l => l.duty_key))

    const isManager = ['Manager', 'Admin'].includes(session.role)

    // Get this user's shift duties for the flight date (for staff/agents only)
    const userShiftDuties = isManager ? [] : await getUserShiftDutiesForDate(session.sub, flightDate)

    // Get responsible staff per duty (keyed by shiftDuty+location for manager view)
    const staffCache = {}
    if (isManager) {
      const combos = [...new Map(dutyTemplates.map(d => {
        const sd  = DUTY_KEY_TO_SHIFT_DUTY[d.key] ?? 'General'
        const loc = DUTY_KEY_TO_LOCATION[d.key] ?? null
        return [`${sd}|${loc ?? ''}`, { sd, loc }]
      })).values()]
      await Promise.all(combos.map(async ({ sd, loc }) => {
        const key = `${sd}|${loc ?? ''}`
        staffCache[key] = await getEmployeesByShiftDutyAndDate(flightDate, sd, flight.airport_id, flight.scheduled_time, loc)
      }))
    }

    const duties = dutyTemplates.map(d => {
      const shiftDuty = DUTY_KEY_TO_SHIFT_DUTY[d.key] ?? 'General'
      const location  = DUTY_KEY_TO_LOCATION[d.key] ?? null
      const cacheKey  = `${shiftDuty}|${location ?? ''}`
      const canPerform = flight.status === 'Scheduled' && (
        isManager
          ? true
          : shiftDuty === 'General' ? userShiftDuties.length > 0 : userShiftDuties.includes(shiftDuty)
      )
      return {
        ...d,
        completed:        completedKeys.has(d.key),
        log:              logs.find(l => l.duty_key === d.key) ?? null,
        canPerform,
        responsibleStaff: isManager ? (staffCache[cacheKey] ?? []) : [],
      }
    })

    return NextResponse.json({ flight, duties })
  } catch (err) {
    console.error('[flights/:id GET]', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['Manager', 'Admin'].includes(session.role)) return forbidden()

  let body
  try { body = await request.json() } catch { return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 }) }

  const { status, completionNotes } = body
  if (!status) return NextResponse.json({ message: 'status required' }, { status: 400 })

  try {
    const updated = await updateFlightStatus(params.flightId, { status, completionNotes })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[flights/:id PUT]', err)
    return NextResponse.json({ message: err.message }, { status: 500 })
  }
}
