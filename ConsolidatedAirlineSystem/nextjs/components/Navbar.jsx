'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useEffect, useState } from 'react'

const STAFF_TABS = [
  { label: 'My Shifts',      href: '/dashboard',       roles: ['Staff','Agent'] },
  { label: 'Flight Duties',  href: '/flights',          roles: ['Staff','Agent','Manager'] },
  { label: 'Manager View',   href: '/manager',          roles: ['Manager'] },
  // Admin-only tabs
  { label: 'Admin Dashboard', href: '/admin',             roles: ['Admin'] },
  { label: 'Flights Today',   href: '/admin/flights',     roles: ['Admin'] },
  { label: 'Shift Overview',  href: '/admin/shifts',      roles: [] }, // hidden from nav
  { label: 'Compliance',      href: '/admin/compliance',  roles: ['Admin'] },
  { label: 'Reports',         href: '/admin/reports',     roles: ['Admin'] },
]

export default function Navbar() {
  const { user, logout, loading } = useAuth()
  const pathname = usePathname()
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showInstallTip, setShowInstallTip] = useState(false)

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') setInstallPrompt(null)
    } else {
      setShowInstallTip(t => !t)
    }
  }

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
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${pathname === tab.href ? 'bg-white text-blue-800' : 'text-blue-100 hover:bg-blue-800'}`}
                  aria-current={pathname === tab.href ? 'page' : undefined}>
                  {tab.label}
                </Link>
              ))}
            </div>
          )}

          {/* Right — install, docs, user info, sign out */}
          <div className="flex items-center gap-2 shrink-0 relative">
            {/* Install App button */}
            <div className="relative">
              <button onClick={handleInstall}
                className="text-blue-100 hover:text-white text-xs border border-blue-500 hover:border-blue-300 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap">
                📲 Install App
              </button>
              {showInstallTip && (
                <div className="absolute right-0 top-10 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 text-xs text-slate-600">
                  <p className="font-semibold text-slate-800 mb-2">Install on your device</p>
                  <p className="mb-1"><strong>iPhone:</strong> Tap Share → "Add to Home Screen"</p>
                  <p><strong>Android:</strong> Tap ⋮ menu → "Install app"</p>
                  <button onClick={() => setShowInstallTip(false)} className="mt-3 text-blue-600 font-medium">Got it ✓</button>
                </div>
              )}
            </div>

            {/* Docs link */}
            <Link href="/docs" target="_blank"
              className="text-blue-100 hover:text-white text-xs border border-blue-500 hover:border-blue-300 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap">
              📄 Docs
            </Link>

            {!loading && user && (
              <>
                <div className="text-right hidden sm:block ml-1">
                  <p className="text-white text-sm font-medium">{user.name}</p>
                  <p className="text-blue-200 text-xs">{user.role} · {user.employeeId}</p>
                  {user.airportId && (
                    <p className="text-xs font-semibold bg-blue-500 text-white px-2 py-0.5 rounded-full mt-0.5 inline-block">
                      {user.airportId} · {user.airportName}
                    </p>
                  )}
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
