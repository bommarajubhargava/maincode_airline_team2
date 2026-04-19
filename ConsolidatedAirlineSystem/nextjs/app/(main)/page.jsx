'use client'
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

const FEATURES = [
  { icon: '📅', title: 'Shift Management',   desc: 'View and track your upcoming shifts in a calendar or list view' },
  { icon: '🔄', title: 'Swap & Change',       desc: 'Request shift swaps, cancellations, or time changes instantly' },
  { icon: '✅', title: 'Request Approvals',   desc: 'Managers review and approve requests in real time' },
  { icon: '👥', title: 'Team Overview',       desc: 'Managers get full visibility across all staff schedules' },
]

export default function HomePage() {
  const { user, loading, login } = useAuth()
  const router = useRouter()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const u = await login(email, password)
      toast.success(`Welcome back, ${u.name}!`)
      const dest = u.role === 'Admin' ? '/admin' : u.role === 'Manager' ? '/manager' : '/dashboard'
      window.location.href = dest
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Already logged in — welcome hub
  if (!loading && user) {
    const isManager = ['Manager', 'Admin'].includes(user.role)
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-800">Welcome back, {user.name.split(' ')[0]} 👋</h1>
          <p className="text-slate-500 mt-1">{user.role} · {user.department} · {user.employeeId}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <Link href={isManager ? '/manager' : '/dashboard'}
            className="card hover:shadow-md transition-shadow border-l-4 border-l-blue-600 group">
            <div className="text-3xl mb-3">{isManager ? '👔' : '📅'}</div>
            <h2 className="font-bold text-slate-800 text-lg group-hover:text-blue-700 transition-colors">
              {isManager ? 'Manager Dashboard' : 'My Shifts'}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {isManager ? 'View all staff shifts, manage requests, edit schedules' : 'View your upcoming shifts and submit requests'}
            </p>
            <span className="inline-block mt-4 text-blue-600 text-sm font-semibold">Go to Dashboard →</span>
          </Link>
          <div className="space-y-4">
            {[
              { icon: '🏢', label: 'Department', value: user.department, color: 'border-l-emerald-500' },
              { icon: '🪪', label: 'Employee ID', value: user.employeeId, color: 'border-l-amber-500' },
              { icon: '🔐', label: 'Access Level', value: user.role,       color: 'border-l-purple-500' },
            ].map(c => (
              <div key={c.label} className={`card border-l-4 ${c.color}`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{c.icon}</span>
                  <div><p className="font-semibold text-slate-700">{c.label}</p><p className="text-slate-500 text-sm">{c.value}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 card bg-blue-50 border-blue-100">
          <h3 className="font-semibold text-slate-700 mb-3">Need help?</h3>
          <div className="grid sm:grid-cols-3 gap-3 text-sm text-slate-600">
            <p>📧 hr@skywave.internal</p><p>☎ +1 (800) 555-0199</p><p>🕐 Mon–Fri 08:00–18:00</p>
          </div>
        </div>
      </div>
    )
  }

  // Not logged in — login form + features
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left — branding */}
          <div className="text-white">
            <div className="text-6xl mb-6">✈️</div>
            <h1 className="text-4xl font-bold mb-3 leading-tight">SkyWave Air<br/>Staff Portal</h1>
            <p className="text-blue-200 text-lg mb-12">
              Manage your shifts, submit requests, and stay in sync with your team — all in one place.
            </p>

            {/* Feature icons */}
            <div className="grid grid-cols-2 gap-5">
              {FEATURES.map(f => (
                <div key={f.title} className="flex gap-3">
                  <span className="text-2xl shrink-0">{f.icon}</span>
                  <div>
                    <p className="font-semibold text-white text-sm">{f.title}</p>
                    <p className="text-blue-300 text-xs mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — login form */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full">
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Sign In</h2>
            <p className="text-slate-500 text-sm mb-7">Enter your staff credentials to continue</p>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="text-sm font-semibold text-slate-600 block mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@skywave.com"
                  required
                  className="input-field py-3"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600 block mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input-field py-3"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-3 text-base mt-2"
              >
                {submitting ? 'Signing in...' : 'Sign In →'}
              </button>
            </form>

            <p className="text-center text-xs text-slate-400 mt-6">
              Authorized staff only. Contact HR if you need access.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
