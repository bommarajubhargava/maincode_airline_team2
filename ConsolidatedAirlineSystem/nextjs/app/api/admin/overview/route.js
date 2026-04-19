import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { getAirportOverview } from '@/lib/store'
import { getDutiesForFlight } from '@/lib/flightDuties'

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
        const flightsWithTotal = flights.map(f => ({
          ...f,
          totalDuties: getDutiesForFlight(f.flight_type).length,
        }))
        return { ...ap, flights: flightsWithTotal, staff }
      })
    )
    return NextResponse.json(results)
  } catch (err) {
    console.error('[admin/overview GET]', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
