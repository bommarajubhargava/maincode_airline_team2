'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'

const todayStr = () => new Date().toISOString().slice(0, 10)

const HOME_AIRPORTS = [
  { id: 'YYZ', name: 'Toronto Pearson International' },
  { id: 'YTZ', name: 'Billy Bishop Toronto City' },
  { id: 'YHM', name: 'John C. Munro Hamilton' },
]

const SHIFT_COLORS = {
  Morning:   'bg-amber-100 text-amber-700',
  Afternoon: 'bg-blue-100 text-blue-700',
  Night:     'bg-indigo-100 text-indigo-700',
}
const DUTY_COLORS = {
  General:  'bg-slate-100 text-slate-600',
  Catering: 'bg-orange-100 text-orange-700',
  Cleanup:  'bg-teal-100 text-teal-700',
}

// ── Staff on Duty popup ───────────────────────────────────────────────────────
function StaffModal({ airport, staffList, onClose }) {
  if (!airport) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-blue-50 border-b border-blue-100 shrink-0">
          <div>
            <p className="font-bold text-slate-800">{airport.id} — Staff on Duty</p>
            <p className="text-xs text-slate-500">{airport.name} · {staffList.length} staff</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto flex-1 p-4 space-y-1.5">
          {staffList.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-8">No staff on duty for this date</p>
          ) : (
            staffList.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.employee_id} · {s.role ?? 'Agent'}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${SHIFT_COLORS[s.shiftType] ?? 'bg-slate-100 text-slate-600'}`}>
                  {s.shiftType}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminOverviewPage() {
  const { user } = useAuth()
  const [date, setDate]         = useState(todayStr())
  const [overview, setOverview] = useState([])
  const [loading, setLoading]   = useState(false)

  // Filters
  const [filterAirport, setFilterAirport] = useState('All')
  const [filterFlight,  setFilterFlight]  = useState('')

  // Staff popup
  const [staffModal, setStaffModal] = useState(null) // { airport, staffList }

  const fetchOverview = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ date })
      const [ovRes, shRes] = await Promise.all([
        fetch(`/api/admin/overview?${params}`),
        fetch(`/api/admin/shifts?${params}`),
      ])
      const ovData = await ovRes.json()
      const shData = await shRes.json()

      const shByAirport = {}
      for (const s of (Array.isArray(shData) ? shData : [])) {
        const ap = s.airport_id || 'Unknown'
        if (!shByAirport[ap]) shByAirport[ap] = []
        shByAirport[ap].push(s)
      }

      setOverview((Array.isArray(ovData) ? ovData : []).map(ap => ({
        ...ap,
        shifts: shByAirport[ap.id] ?? [],
      })))
    } catch { toast.error('Failed to load overview') }
    finally { setLoading(false) }
  }, [date])

  useEffect(() => { fetchOverview() }, [fetchOverview])

  // All flight numbers across all airports (for filter dropdown)
  const allFlightNos = [...new Set(
    overview.flatMap(ap => (ap.flights ?? []).map(f => f.flight_number))
  )].sort()

  // Filtered overview
  const filteredOverview = overview
    .filter(ap => filterAirport === 'All' || ap.id === filterAirport)
    .map(ap => ({
      ...ap,
      flights: (ap.flights ?? []).filter(f =>
        !filterFlight || f.flight_number === filterFlight
      ),
    }))

  // Aggregate totals (from full unfiltered data)
  const totalFlights     = overview.reduce((s, ap) => s + (ap.flights?.length ?? 0), 0)
  const completedFlights = overview.reduce((s, ap) => s + (ap.flights?.filter(f => f.status === 'Completed').length ?? 0), 0)
  const totalDuties      = overview.reduce((s, ap) => s + (ap.flights?.reduce((d, f) => d + (f.totalDuties ?? 0), 0) ?? 0), 0)
  const completedDuties  = overview.reduce((s, ap) => s + (ap.flights?.reduce((d, f) => d + (f.completedDuties ?? 0), 0) ?? 0), 0)
  const totalStaff       = overview.reduce((s, ap) => s + new Set(ap.shifts?.map(sh => sh.id)).size, 0)

  const hasFilter = filterAirport !== 'All' || filterFlight !== ''

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <StaffModal
        airport={staffModal?.airport}
        staffList={staffModal?.staffList ?? []}
        onClose={() => setStaffModal(null)}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
          <p className="text-slate-500 text-sm">{user?.name} · All Airports</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field text-sm" />
          </div>
          <button onClick={fetchOverview} className="btn-primary text-sm self-end">Refresh</button>
          <button disabled className="btn-secondary text-sm self-end text-slate-300 border-slate-200 cursor-not-allowed opacity-50">
            ↺ Reseed DB
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Airport</label>
          <select value={filterAirport} onChange={e => { setFilterAirport(e.target.value); setFilterFlight('') }} className="input-field text-sm w-48">
            <option value="All">All Airports</option>
            {HOME_AIRPORTS.map(a => <option key={a.id} value={a.id}>{a.id} — {a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Flight No.</label>
          <select value={filterFlight} onChange={e => setFilterFlight(e.target.value)} className="input-field text-sm w-44">
            <option value="">All Flights</option>
            {allFlightNos
              .filter(fn => {
                if (filterAirport === 'All') return true
                const ap = overview.find(a => a.id === filterAirport)
                return ap?.flights?.some(f => f.flight_number === fn)
              })
              .map(fn => <option key={fn} value={fn}>{fn}</option>)}
          </select>
        </div>
        {hasFilter && (
          <button onClick={() => { setFilterAirport('All'); setFilterFlight('') }}
            className="text-xs text-blue-600 hover:text-blue-800 self-end mb-1">
            Clear filters
          </button>
        )}
      </div>

      {/* Network-wide stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Flights',           value: totalFlights,     color: 'text-blue-700' },
          { label: 'Completed Flights', value: completedFlights, color: 'text-emerald-600' },
          { label: 'Total Duties',      value: totalDuties,      color: 'text-slate-700' },
          { label: 'Duties Done',       value: completedDuties,  color: 'text-emerald-600' },
          { label: 'Staff on Duty',     value: totalStaff,       color: 'text-purple-600' },
        ].map(s => (
          <div key={s.label} className="card py-3 px-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><p className="text-slate-500">Loading…</p></div>
      ) : (
        <div className="space-y-6">
          {filteredOverview.map(ap => {
            const apFlights     = ap.flights ?? []
            const apShifts      = ap.shifts  ?? []
            const apCompleted   = apFlights.filter(f => f.status === 'Completed').length
            const apTotalDuties = apFlights.reduce((s, f) => s + (f.totalDuties ?? 0), 0)
            const apDoneDuties  = apFlights.reduce((s, f) => s + (f.completedDuties ?? 0), 0)
            const dutyPct       = apTotalDuties > 0 ? Math.round((apDoneDuties / apTotalDuties) * 100) : 0

            // Unique staff
            const staffMap = {}
            for (const sh of apShifts) staffMap[sh.id] = sh
            const staffList = Object.values(staffMap)

            // Duty breakdown
            const dutyBreakdown = {}
            for (const sh of apShifts) {
              if (!dutyBreakdown[sh.duty]) dutyBreakdown[sh.duty] = 0
              dutyBreakdown[sh.duty]++
            }

            return (
              <div key={ap.id} className="card border border-slate-200">
                {/* Airport header */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-lg font-bold text-slate-800">{ap.id}</span>
                      <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{ap.name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-xs text-slate-500">{apFlights.length} flights</p>
                      <button
                        onClick={() => setStaffModal({ airport: ap, staffList })}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 hover:underline"
                      >
                        👥 {staffList.length} staff on duty →
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className={`text-xl font-bold ${dutyPct === 100 ? 'text-emerald-600' : dutyPct > 50 ? 'text-amber-500' : 'text-red-500'}`}>{dutyPct}%</p>
                      <p className="text-xs text-slate-500">Duty completion</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-slate-700">{apCompleted}/{apFlights.length}</p>
                      <p className="text-xs text-slate-500">Flights done</p>
                    </div>
                  </div>
                </div>

                {/* Operations breakdown + flight status */}
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Operations Breakdown</p>
                    {Object.keys(dutyBreakdown).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No shift data</p>
                    ) : (
                      <div className="space-y-1.5">
                        {Object.entries(dutyBreakdown).map(([duty, cnt]) => (
                          <div key={duty} className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${DUTY_COLORS[duty] ?? 'bg-slate-100 text-slate-600'}`}>{duty}</span>
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(cnt / apShifts.length) * 100}%` }} />
                            </div>
                            <span className="text-xs text-slate-500 shrink-0">{cnt} shifts</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Flight Status</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: 'Scheduled', count: apFlights.filter(f => f.status === 'Scheduled').length, color: 'bg-blue-50 text-blue-700 border-blue-200' },
                        { label: 'Completed', count: apFlights.filter(f => f.status === 'Completed').length, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                        { label: 'Cancelled', count: apFlights.filter(f => f.status === 'Cancelled').length, color: 'bg-red-50 text-red-600 border-red-200' },
                      ].map(s => (
                        <div key={s.label} className={`border rounded-lg px-2 py-1.5 text-center ${s.color}`}>
                          <p className="font-bold text-base">{s.count}</p>
                          <p className="text-xs">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Flights with duty & staff breakdown */}
                {apFlights.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Flights & Duty Assignments</p>
                    <div className="space-y-2">
                      {apFlights.map(f => {
                        const pct = f.totalDuties > 0 ? Math.round((f.completedDuties / f.totalDuties) * 100) : 0
                        const isCancelled = f.status === 'Cancelled'
                        const isCompleted = f.status === 'Completed'
                        return (
                          <div key={f.id} className={`border rounded-xl p-3 ${isCancelled ? 'border-red-100 bg-red-50/40' : isCompleted ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-100 bg-slate-50/60'}`}>
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-800 text-sm">{f.flight_number}</span>
                                <span className="text-xs text-slate-500">{f.from_airport} → {f.to_airport}</span>
                                <span className="text-xs text-slate-400">{new Date(f.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${isCancelled ? 'bg-red-100 text-red-600' : isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {f.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className={`text-xs font-bold ${pct === 100 ? 'text-emerald-600' : pct > 50 ? 'text-amber-500' : 'text-red-500'}`}>{pct}%</span>
                              </div>
                            </div>
                            {f.duties?.length > 0 && (
                              <div className="grid sm:grid-cols-2 gap-1">
                                {f.duties.map(d => (
                                  <div key={d.key} className={`flex items-start gap-2 text-xs px-2 py-1.5 rounded-lg ${d.completed ? 'bg-emerald-50 border border-emerald-100' : 'bg-white border border-slate-100'}`}>
                                    <span className="shrink-0 mt-0.5">{d.icon}</span>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className={`font-semibold truncate ${d.completed ? 'text-emerald-700' : 'text-slate-700'}`}>{d.label}</span>
                                        {d.completed && <span className="text-emerald-500 shrink-0">✓</span>}
                                      </div>
                                      {d.staff?.length > 0
                                        ? <p className="text-slate-400 truncate">{d.staff.map(s => s.name).join(', ')}</p>
                                        : <p className="text-slate-300 italic">Unassigned</p>
                                      }
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic text-center py-4">No flights match the current filter</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
