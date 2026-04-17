'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

const STAFF_TABS = [
  { label: 'My Shifts',    href: '/dashboard', roles: ['Staff','Agent'] },
  { label: 'Catering',     href: '/catering',  roles: ['Staff','Agent','Manager','Admin'] },
  { label: 'Manager View', href: '/manager',   roles: ['Manager','Admin'] },
]

export default function Navbar() {
  const { user, logout, loading } = useAuth()
  const pathname = usePathname()

  const tabs = STAFF_TABS.filter(t => user && t.roles.includes(user.role))

  return (
    <nav className="bg-gradient-to-r from-blue-900 to-blue-700 shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-2xl">✈️</span>
            <div>
              <span className="text-white font-bold text-lg leading-none">SkyWave Air</span>
              <span className="text-blue-200 text-xs block leading-none">Staff Portal</span>
            </div>
          </Link>

          {/* Staff nav — only when logged in */}
          {tabs.length > 0 && (
            <div className="flex items-center gap-1">
              <Link href="/" className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${pathname === '/' ? 'bg-white text-blue-800' : 'text-blue-100 hover:bg-blue-800'}`}>
                Home
              </Link>
              {tabs.map(tab => (
                <Link key={tab.href} href={tab.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${pathname === tab.href ? 'bg-white text-blue-800' : 'text-blue-100 hover:bg-blue-800'}`}>
                  {tab.label}
                </Link>
              ))}
            </div>
          )}

          {/* Right — user info + sign out when logged in, nothing when logged out */}
          <div className="flex items-center gap-3 shrink-0">
            {!loading && user && (
              <>
                <div className="text-right hidden sm:block">
                  <p className="text-white text-sm font-medium">{user.name}</p>
                  <p className="text-blue-200 text-xs">{user.role} · {user.employeeId}</p>
                </div>
                <button onClick={logout} className="text-blue-100 hover:text-white text-sm border border-blue-400 hover:border-white px-3 py-1.5 rounded-lg transition-colors">
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
