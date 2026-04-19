import { getSession, unauthorized } from '@/lib/auth'
import { FLIGHTS } from '@/lib/flightData'
import { getCateringLog } from '@/lib/store'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  const flights = await Promise.all(FLIGHTS.map(async f => ({
    ...f,
    log: (await getCateringLog(f.id)) ?? null,
  })))

  return NextResponse.json(flights)
}
