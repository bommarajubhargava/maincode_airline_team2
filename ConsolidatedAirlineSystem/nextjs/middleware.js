import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'

const PROTECTED = {
  '/dashboard': ['Staff', 'Agent'],
  '/manager':   ['Manager', 'Admin'],
  '/catering':  ['Staff', 'Agent', 'Manager', 'Admin'],
}

export async function middleware(request) {
  const { pathname } = request.nextUrl

  const entry = Object.entries(PROTECTED).find(([path]) => pathname.startsWith(path))
  if (!entry) return NextResponse.next()

  const token = request.cookies.get('token')?.value
  if (!token) return NextResponse.redirect(new URL('/', request.url))

  const session = await verifyToken(token)
  if (!session) return NextResponse.redirect(new URL('/', request.url))

  const [, allowedRoles] = entry
  if (!allowedRoles.includes(session.role)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/manager/:path*', '/catering/:path*'],
}
