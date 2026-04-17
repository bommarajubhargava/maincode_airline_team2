'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const CATEGORY_ICONS  = { Toilets: '🚽', Seats: '💺', Floors: '🧹', Overhead: '🗄️', Galley: '🍳' }
const CATEGORY_COLORS = {
  Toilets:  'bg-blue-50 border-blue-200',
  Seats:    'bg-purple-50 border-purple-200',
  Floors:   'bg-amber-50 border-amber-200',
  Overhead: 'bg-slate-50 border-slate-200',
  Galley:   'bg-green-50 border-green-200',
}

export default function CleanupPage() {
  const { user } = useAuth()
  const [flights, setFlights]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState(null)   // { flight, tasks, log }
  const [checked, setChecked]         = useState({})
  const [submitting, setSubmitting]   = useState(false)

  const fetchFlights = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cleanup')
      setFlights(await res.json())
    } catch { toast.error('Failed to load flights') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchFlights() }, [])

  const openFlight = async (flight) => {
    try {
      const res = await fetch(`/api/cleanup/${flight.id}`)
      const data = await res.json()
      setSelected(data)
      const init = {}
      data.tasks.forEach(t => {
        init[t.key] = data.log ? JSON.parse(data.log.tasksJson)[t.key] ?? false : false
      })
      setChecked(init)
    } catch { toast.error('Failed to load flight details') }
  }

  const toggleTask = (key) => {
    if (selected?.log) return
    setChecked(c => ({ ...c, [key]: !c[key] }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/cleanup/${selected.flight.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: checked }),
      })
      let data
      try { data = await res.json() } catch { data = {} }
      if (!res.ok) throw new Error(data.message || 'Submission failed')
      toast.success('✅ Cleanup logged successfully!')
      setSelected(null)
      fetchFlights()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  const grouped = (tasks) =>
    tasks.reduce((acc, t) => {
      if (!acc[t.category]) acc[t.category] = []
      acc[t.category].push(t)
      return acc
    }, {})

  const completedCount = Object.values(checked).filter(Boolean).length
  const totalCount = selected?.tasks?.length ?? 0

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center"><div className="text-4xl mb-3">🧹</div><p className="text-slate-500">Loading flights...</p></div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Aircraft Cleanup</h1>
        <p className="text-slate-500 text-sm">{user?.name} · {flights.length} flights today</p>
      </div>

      {/* Prompt banner */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 items-start">
        <span className="text-2xl shrink-0">🧹</span>
        <div>
          <p className="font-semibold text-blue-800 text-sm">Cleanup Checklist Required</p>
          <p className="text-blue-600 text-xs mt-0.5">Select a flight below and confirm that <strong>toilets</strong>, <strong>seats</strong>, <strong>floors</strong>, <strong>overhead bins</strong>, and <strong>galley</strong> have been cleaned before departure.</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total Flights', value: flights.length,                      color: 'text-blue-700 bg-blue-50' },
          { label: 'Cleaned',       value: flights.filter(f => f.log).length,   color: 'text-emerald-700 bg-emerald-50' },
          { label: 'Pending',       value: flights.filter(f => !f.log).length,  color: 'text-amber-700 bg-amber-50' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color.split(' ')[1]}`}>
            <p className={`text-2xl font-bold ${s.color.split(' ')[0]}`}>{s.value}</p>
            <p className="text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Flight cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {flights.map(f => (
          <button key={f.id} onClick={() => openFlight(f)}
            className={`card text-left hover:shadow-md transition-shadow border-2 ${f.log ? 'border-emerald-200' : 'border-transparent'}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-bold text-slate-800 text-lg">{f.flightNumber}</p>
                <p className="text-xs text-slate-400">{f.aircraft}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${f.log ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {f.log ? '✓ Cleaned' : 'Pending'}
              </span>
            </div>
            <p className="text-sm text-slate-700 font-medium">{f.origin}</p>
            <p className="text-xs text-slate-400">→ {f.destination}</p>
            <p className="text-xs text-slate-500 mt-1">🕐 {format(new Date(f.departureTime), 'HH:mm, MMM d')}</p>
            <p className="text-xs text-slate-400 mt-1">👥 {f.passengers} passengers</p>
          </button>
        ))}
      </div>

      {/* Checklist modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="font-bold text-slate-800 text-lg">{selected.flight.flightNumber} — Cleanup Checklist</h2>
                <p className="text-sm text-slate-500">
                  {selected.flight.origin} → {selected.flight.destination} · {format(new Date(selected.flight.departureTime), 'HH:mm, MMM d')}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            {/* Progress bar */}
            {!selected.log && (
              <div className="px-6 pt-4 shrink-0">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Progress</span>
                  <span>{completedCount} / {totalCount} tasks</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: totalCount ? `${(completedCount / totalCount) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            )}

            {/* Checklist body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {Object.entries(grouped(selected.tasks)).map(([cat, tasks]) => (
                <div key={cat} className={`rounded-xl border p-4 ${CATEGORY_COLORS[cat]}`}>
                  <p className="text-xs font-bold text-slate-600 mb-3">{CATEGORY_ICONS[cat]} {cat.toUpperCase()}</p>
                  <div className="space-y-2">
                    {tasks.map(task => {
                      const isDone = !!checked[task.key]
                      return (
                        <label key={task.key}
                          className={`flex items-center gap-3 bg-white rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${isDone ? 'bg-emerald-50' : ''} ${selected.log ? 'cursor-default' : 'hover:bg-slate-50'}`}>
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => toggleTask(task.key)}
                            disabled={!!selected.log}
                            className="w-4 h-4 accent-emerald-600 cursor-pointer"
                          />
                          <span className={`text-sm font-medium flex-1 ${isDone ? 'text-emerald-700 line-through' : 'text-slate-700'}`}>
                            {task.label}
                          </span>
                          {isDone && <span className="text-emerald-500 text-sm">✓</span>}
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 shrink-0">
              {selected.log ? (
                <div className="text-center text-sm text-emerald-700 font-semibold">
                  ✅ Cleanup completed on {format(new Date(selected.log.completedAt), 'MMM d, HH:mm')}
                </div>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setSelected(null)} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1">
                    {submitting ? 'Submitting...' : '🧹 Confirm Cleanup'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
