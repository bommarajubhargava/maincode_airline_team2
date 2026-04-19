import { getSession, unauthorized } from '@/lib/auth'
import { getShiftsByDate, getEmployees } from '@/lib/store'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  if (!date) return NextResponse.json({ message: 'date param required' }, { status: 400 })

  try {
    const [shifts, employees] = await Promise.all([getShiftsByDate(date), getEmployees()])
    const empMap = Object.fromEntries(employees.map(e => [e.id, e]))
    let enriched = shifts.map(s => {
      const emp = empMap[s.userId]
      return { ...s, userName: emp?.name ?? 'Unknown', role: emp?.role ?? '', employeeId: emp?.employee_id ?? '', department: emp?.department ?? '', airportId: emp?.airport_id ?? '' }
    })
    if (session.airportId) {
      enriched = enriched.filter(s => s.airportId === session.airportId)
    }
    return NextResponse.json(enriched)
  } catch (err) {
    console.error('[shifts/day GET]', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
