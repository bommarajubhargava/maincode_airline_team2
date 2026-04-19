export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { getAirportOverview, getFlightDutyLogs, getEmployeesByShiftDutyAndDate } from '@/lib/store'
import { getDutiesForFlight, DUTY_KEY_TO_SHIFT_DUTY, DUTY_KEY_TO_LOCATION } from '@/lib/flightDuties'

const HOME_AIRPORTS = [
  { id: 'YYZ', name: 'Toronto Pearson International' },
  { id: 'YTZ', name: 'Billy Bishop Toronto City' },
  { id: 'YHM', name: 'John C. Munro Hamilton' },
]

export async function GET(request) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.role !== 'Admin') return forbidden()

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || undefined

  try {
    const results = await Promise.all(
      HOME_AIRPORTS.map(async ap => {
        const { flights, staff } = await getAirportOverview(ap.id, date)

        const flightsWithDuties = await Promise.all(flights.map(async f => {
          const dutyTemplates = getDutiesForFlight(f.flight_type)
          const logs = await getFlightDutyLogs(f.id)
          const completedKeys = new Set(logs.map(l => l.duty_key))
          const flightDate = f.scheduled_time.slice(0, 10)

          // Build staff cache per unique shiftDuty+location combo
          const combos = [...new Map(dutyTemplates.map(d => {
            const sd  = DUTY_KEY_TO_SHIFT_DUTY[d.key] ?? 'General'
            const loc = DUTY_KEY_TO_LOCATION[d.key] ?? null
            return [`${sd}|${loc ?? ''}`, { sd, loc }]
          })).values()]

          const staffCache = {}
          await Promise.all(combos.map(async ({ sd, loc }) => {
            const key = `${sd}|${loc ?? ''}`
            staffCache[key] = await getEmployeesByShiftDutyAndDate(flightDate, sd, ap.id, f.scheduled_time, loc)
          }))

          const duties = dutyTemplates.map(d => {
            const sd  = DUTY_KEY_TO_SHIFT_DUTY[d.key] ?? 'General'
            const loc = DUTY_KEY_TO_LOCATION[d.key] ?? null
            return {
              key:       d.key,
              label:     d.label,
              icon:      d.icon,
              completed: completedKeys.has(d.key),
              staff:     staffCache[`${sd}|${loc ?? ''}`] ?? [],
            }
          })

          return {
            ...f,
            totalDuties:     dutyTemplates.length,
            completedDuties: completedKeys.size,
            duties,
          }
        }))

        return { ...ap, flights: flightsWithDuties, staff }
      })
    )
    return NextResponse.json(results)
  } catch (err) {
    console.error('[admin/overview GET]', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
