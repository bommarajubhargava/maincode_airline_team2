import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth'
import { getFlights } from '@/lib/store'

export async function GET(request) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { searchParams } = new URL(request.url)
  const type         = searchParams.get('type')         || undefined
  const today        = searchParams.get('today')        === 'true'
  const date         = searchParams.get('date')         || undefined
  const flightNumber = searchParams.get('flightNumber') || undefined
  // Admin can pass ?airport=YYZ to scope; non-admin always scoped to their airport
  const airportId    = session.role === 'Admin'
    ? (searchParams.get('airport') || undefined)
    : (session.airportId || undefined)

  try {
    const flights = await getFlights({ type, today: today && !date, date, flightNumber, airportId })
    return NextResponse.json(flights)
  } catch (err) {
    console.error('[flights GET]', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
