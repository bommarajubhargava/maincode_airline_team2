import { SignJWT, jwtVerify } from 'jose'

const secret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-dev-secret-32-chars-min!!')

export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret())
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload
  } catch {
    return null
  }
}
