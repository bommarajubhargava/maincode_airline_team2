export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth'
import { getDMConversations, getEmployees, findEmployeeById, safeEmployee } from '@/lib/store'

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  try {
    const self = await findEmployeeById(session.sub)
    const airportId = self?.airport_id ?? session.airportId

    // All employees for DM list (scoped to airport, except Admin sees all)
    const allEmployees = await getEmployees()
    let peers = allEmployees
      .filter(e => e.id !== session.sub)
      .map(safeEmployee)

    if (session.role !== 'Admin') {
      peers = peers.filter(e => e.airportId === airportId)
    }

    // Airport channels available to this user
    const HOME_AIRPORTS = [
      { id: 'YYZ', name: 'Toronto Pearson' },
      { id: 'YTZ', name: 'Billy Bishop' },
      { id: 'YHM', name: 'Hamilton' },
    ]
    const channels = session.role === 'Admin'
      ? HOME_AIRPORTS
      : HOME_AIRPORTS.filter(a => a.id === airportId)

    // Recent DM conversations
    const dmConversations = await getDMConversations(session.sub)

    return NextResponse.json({ channels, peers, dmConversations })
  } catch (err) {
    console.error('[chat/conversations GET]', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
