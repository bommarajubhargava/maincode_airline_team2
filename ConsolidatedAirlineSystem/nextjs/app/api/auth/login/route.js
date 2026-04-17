import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { findUserByEmail, safeUser } from '@/lib/mockUsers'
import { signToken } from '@/lib/jwt'

export async function POST(request) {
  const { email, password } = await request.json()

  if (!email || !password)
    return NextResponse.json({ message: 'Email and password are required' }, { status: 400 })

  const user = findUserByEmail(email)
  if (!user || !bcrypt.compareSync(password, user.passwordHash))
    return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 })

  const token = await signToken({
    sub: user.id, email: user.email, name: user.name,
    role: user.role, employeeId: user.employeeId, department: user.department,
  })

  const response = NextResponse.json({ user: safeUser(user) })
  response.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })
  return response
}
