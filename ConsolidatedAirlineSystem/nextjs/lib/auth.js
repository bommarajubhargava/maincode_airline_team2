import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyToken } from './jwt'

export async function getSession() {
  const token = cookies().get('token')?.value
  if (!token) return null
  return verifyToken(token)
}

export const unauthorized = (msg = 'Unauthorized') =>
  NextResponse.json({ message: msg }, { status: 401 })

export const forbidden = (msg = 'Forbidden') =>
  NextResponse.json({ message: msg }, { status: 403 })

export const notFound = (msg = 'Not found') =>
  NextResponse.json({ message: msg }, { status: 404 })

export const badRequest = (msg) =>
  NextResponse.json({ message: msg }, { status: 400 })
