import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth'
import { getShifts } from '@/lib/store'
import { findUserById } from '@/lib/mockUsers'

export function enrichShift(s) {
  const user = findUserById(s.userId)
  return { ...s, userName: user?.name ?? '', employeeId: user?.employeeId ?? '', department: user?.department ?? '' }
}

export async function GET(request) {
  const session = await getSession()
  if (!session) return unauthorized()

  const days = Number(new URL(request.url).searchParams.get('days') || 30)
  const from = new Date(); from.setHours(0,0,0,0)
  const to   = new Date(from); to.setDate(from.getDate() + days)

  const shifts = getShifts()
    .filter(s => s.userId === session.sub && new Date(s.startTime) >= from && new Date(s.startTime) < to)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    .map(enrichShift)

  return NextResponse.json(shifts)
}
