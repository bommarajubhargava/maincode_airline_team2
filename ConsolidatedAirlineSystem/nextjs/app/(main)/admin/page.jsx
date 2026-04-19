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

export default function AdminOverviewPage() {
  const { user } = useAuth()
  const [date, setDate]       = useState(todayStr())
  const [overview, setOverview] = useState([])
  const [loading, setLoading] = useState(false)

  const [reseeding, setReseeding] = useState(false)

  const handleReseed = async () => {
    if (!confirm('This will wipe and restore ALL data to the default seed. Continue?')) return
    setReseeding(true)
    try {
      const res = await fetch('/api/admin/reseed', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      toast.success('Database reseeded! All employees restored.')
      fetchOverview()
    } catch (err) { toast.error(err.message) }
    finally { setReseeding(false) }
  }

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

      // Merge shift rows into each airport's data
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

  // Aggregate totals
  const totalFlights        = overview.reduce((s, ap) => s + (ap.flights?.length ?? 0), 0)
  const completedFlights    = overview.reduce((s, ap) => s + (ap.flights?.filter(f => f.status === 'Completed').length ?? 0), 0)
  const totalDuties         = overview.reduce((s, ap) => s + (ap.flights?.reduce((d, f) => d + (f.totalDuties ?? 0), 0) ?? 0), 0)
  const completedDuties     = overview.reduce((s, ap) => s + (ap.flights?.reduce((d, f) => d + (f.completedDuties ?? 0), 0) ?? 0), 0)
  const totalStaff          = overview.reduce((s, ap) => s + new Set(ap.shifts?.map(sh => sh.id)).size, 0)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
          <p className="text-slate-500 text-sm">{user?.name} · All Airports</p>
        </div>
        <div className="flex items-center gap-2">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field text-sm" />
          </div>
          <button onClick={fetchOverview} className="btn-primary text-sm self-end">Refresh</button>
          <button onClick={handleReseed} disabled={reseeding} className="btn-secondary text-sm self-end text-red-600 border-red-200 hover:bg-red-50">
            {reseeding ? 'Reseeding…' : '↺ Reseed DB'}
          </button>
        </div>
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
          {overview.map(ap => {
            const apFlights    = ap.flights ?? []
            const apShifts     = ap.shifts  ?? []
            const apCompleted  = apFlights.filter(f => f.status === 'Completed').length
            const apTotalDuties = apFlights.reduce((s, f) => s + (f.totalDuties ?? 0), 0)
            const apDoneDuties  = apFlights.reduce((s, f) => s + (f.completedDuties ?? 0), 0)
            const dutyPct       = apTotalDuties > 0 ? Math.round((apDoneDuties / apTotalDuties) * 100) : 0

            // Unique staff (deduplicate by id)
            const staffMap = {}
            for (const sh of apShifts) staffMap[sh.id] = sh
            const staffList = Object.values(staffMap)

            // Shift breakdown by type
            const shiftBreakdown = {}
            for (const sh of apShifts) {
              const k = sh.shiftType
              if (!shiftBreakdown[k]) shiftBreakdown[k] = 0
              shiftBreakdown[k]++
            }

            // Duty breakdown count
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
                    <p className="text-xs text-slate-500">{staffList.length} staff on duty · {apFlights.length} flights</p>
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

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Staff & shift type breakdown */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Staff on Duty</p>
                    {staffList.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">No shifts assigned</p>
                    ) : (
                      <div className="space-y-1.5">
                        {staffList.map(s => (
                          <div key={s.id} className="flex items-center gap-2 text-xs">
                            <span className={`px-2 py-0.5 rounded-full font-semibold shrink-0 ${SHIFT_COLORS[s.shiftType] ?? 'bg-slate-100 text-slate-600'}`}>{s.shiftType}</span>
                            <span className="font-medium text-slate-700 truncate">{s.name}</span>
                            <span className="text-slate-400 shrink-0">{s.employee_id}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Operations breakdown */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Operations Breakdown</p>
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

                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-3 mb-2">Flight Status</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: 'Scheduled', count: apFlights.filter(f => f.status === 'Scheduled').length,  color: 'bg-blue-50 text-blue-700 border-blue-200' },
                        { label: 'Completed', count: apFlights.filter(f => f.status === 'Completed').length,  color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                        { label: 'Cancelled', count: apFlights.filter(f => f.status === 'Cancelled').length,  color: 'bg-red-50 text-red-600 border-red-200' },
                      ].map(s => (
                        <div key={s.label} className={`border rounded-lg px-2 py-1.5 text-center ${s.color}`}>
                          <p className="font-bold text-base">{s.count}</p>
                          <p className="text-xs">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
