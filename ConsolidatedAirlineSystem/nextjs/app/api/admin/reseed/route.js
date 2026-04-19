export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSession, unauthorized, forbidden } from '@/lib/auth'
import { forceReseed } from '@/lib/store'

export async function POST() {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.role !== 'Admin') return forbidden()

  try {
    await forceReseed()
    return NextResponse.json({ message: 'Database reseeded successfully. All employees and data restored.' })
  } catch (err) {
    console.error('[reseed]', err)
    return NextResponse.json({ message: err.message }, { status: 500 })
  }
}
