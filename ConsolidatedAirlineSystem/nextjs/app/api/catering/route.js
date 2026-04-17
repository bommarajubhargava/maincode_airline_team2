import { getSession, unauthorized } from '@/lib/auth'
import { FLIGHTS } from '@/lib/flightData'
import { getCateringLog } from '@/lib/store'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  const flights = FLIGHTS.map(f => ({
    ...f,
    log: getCateringLog(f.id) ?? null,
  }))

  return NextResponse.json(flights)
}
