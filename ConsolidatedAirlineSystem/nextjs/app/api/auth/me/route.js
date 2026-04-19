export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { findEmployeeById, safeEmployee } from '@/lib/store'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ user: null })
    const emp = await findEmployeeById(session.sub)
    if (!emp) return NextResponse.json({ user: null })
    return NextResponse.json({ user: safeEmployee(emp) })
  } catch (err) {
    console.error('[auth/me GET]', err)
    return NextResponse.json({ user: null })
  }
}
