import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { findEmployeeByEmail, safeEmployee } from '@/lib/store'
import { signToken } from '@/lib/jwt'

export async function POST(request) {
  let body
  try { body = await request.json() } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }
  const { email, password } = body

  if (!email || !password)
    return NextResponse.json({ message: 'Email and password are required' }, { status: 400 })

  let emp
  try { emp = await findEmployeeByEmail(email) } catch (err) {
    console.error('[login POST DB error]', err)
    return NextResponse.json({ message: `DB error: ${err.message}` }, { status: 503 })
  }
  if (!emp || !bcrypt.compareSync(password, emp.password_hash))
    return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 })

  try {
    const token = await signToken({
      sub: emp.id, email: emp.email, name: emp.name,
      role: emp.role, employeeId: emp.employee_id, department: emp.department,
      airportId: emp.airport_id ?? null, airportName: emp.airport_name ?? null,
    })
    const response = NextResponse.json({ user: safeEmployee(emp) })
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,
      path: '/',
    })
    return response
  } catch (err) {
    console.error('[login POST signToken]', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
