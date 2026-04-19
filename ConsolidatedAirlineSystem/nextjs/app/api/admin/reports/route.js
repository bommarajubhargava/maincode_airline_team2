import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import {
  getCompletionReport,
  getAttendanceReport,
  getDutyPerformanceReport,
  getStaffUtilizationReport,
} from '@/lib/store'

export async function GET(request) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.role !== 'Admin') return forbidden()

  const { searchParams } = new URL(request.url)
  const type      = searchParams.get('type')      || 'flight_completion'
  const airport   = searchParams.get('airport')   || null
  const startDate = searchParams.get('startDate') || null
  const endDate   = searchParams.get('endDate')   || null

  if (!startDate || !endDate)
    return NextResponse.json({ message: 'startDate and endDate are required' }, { status: 400 })

  try {
    let data
    switch (type) {
      case 'attendance':
        data = await getAttendanceReport(airport, startDate, endDate); break
      case 'duty_performance':
        data = await getDutyPerformanceReport(airport, startDate, endDate); break
      case 'staff_utilization':
        data = await getStaffUtilizationReport(airport, startDate, endDate); break
      case 'flight_completion':
      default:
        data = await getCompletionReport(airport, startDate, endDate)
    }
    return NextResponse.json(data)
  } catch (err) {
    console.error('[admin/reports GET]', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
