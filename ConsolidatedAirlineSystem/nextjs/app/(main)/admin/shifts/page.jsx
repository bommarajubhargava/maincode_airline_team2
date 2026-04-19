'use client'
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

const todayStr = () => new Date().toISOString().slice(0, 10)

const HOME_AIRPORTS = [
  { id: 'YYZ', name: 'Toronto Pearson International' },
  { id: 'YTZ', name: 'Billy Bishop Toronto City' },
  { id: 'YHM', name: 'John C. Munro Hamilton' },
]

const SHIFT_COLORS = {
  Morning:   'bg-amber-100 text-amber-700 border-amber-200',
  Afternoon: 'bg-blue-100 text-blue-700 border-blue-200',
  Night:     'bg-indigo-100 text-indigo-700 border-indigo-200',
}
const DUTY_COLORS = {
  General:  'bg-slate-100 text-slate-600',
  Catering: 'bg-orange-100 text-orange-700',
  Cleanup:  'bg-teal-100 text-teal-700',
}
const STATUS_COLORS = {
  Scheduled: 'bg-blue-50 text-blue-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-red-50 text-red-600',
}

function fmt(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function AdminShiftsPage() {
  const [date, setDate]     = useState(todayStr())
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(false)

  const fetchShifts = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/admin/shifts?date=${date}`)
      const data = await res.json()
      setRows(Array.isArray(data) ? data : [])
    } catch { toast.error('Failed to load shifts') }
    finally { setLoading(false) }
  }, [date])

  useEffect(() => { fetchShifts() }, [fetchShifts])

  // Group rows by airport then by employee (dedup duty rows)
  const byAirport = {}
  for (const r of rows) {
    const ap = r.airport_id || 'Unknown'
    if (!byAirport[ap]) byAirport[ap] = {}
    if (!byAirport[ap][r.id]) byAirport[ap][r.id] = { ...r, duties: [] }
    byAirport[ap][r.id].duties.push({ duty: r.duty, shiftType: r.shiftType, status: r.status, startTime: r.startTime, endTime: r.endTime })
  }

  const totalWorking = Object.values(byAirport).reduce((s, emp) => s + Object.keys(emp).length, 0)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Shift Overview</h1>
          <p className="text-slate-500 text-sm">All airports · {totalWorking} staff on duty</p>
        </div>
        <div className="flex items-center gap-2">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field text-sm" />
          </div>
          <button onClick={fetchShifts} className="btn-primary text-sm self-end">Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><p className="text-slate-500">Loading…</p></div>
      ) : (
        <div className="space-y-6">
          {HOME_AIRPORTS.map(ap => {
            const empMap = byAirport[ap.id] ?? {}
            const employees = Object.values(empMap)

            return (
              <div key={ap.id} className="card border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-base font-bold text-slate-800">{ap.id}</span>
                    <span className="ml-2 text-sm text-slate-500">{ap.name}</span>
                  </div>
                  <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                    {employees.length} staff
                  </span>
                </div>

                {employees.length === 0 ? (
                  <p className="text-sm text-slate-400 italic text-center py-4">No shifts on this date</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          {['Name', 'Employee ID', 'Designation', 'Shift', 'Time', 'Duties', 'Status'].map(h => (
                            <th key={h} className="pb-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {employees.map(emp => {
                          const firstDuty = emp.duties[0]
                          return (
                            <tr key={emp.id} className="border-b border-slate-50 hover:bg-slate-50">
                              <td className="py-2.5 font-medium text-slate-800">{emp.name}</td>
                              <td className="py-2.5 text-slate-500">{emp.employee_id}</td>
                              <td className="py-2.5 text-slate-500 text-xs">{emp.designation}</td>
                              <td className="py-2.5">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${SHIFT_COLORS[firstDuty?.shiftType] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                  {firstDuty?.shiftType}
                                </span>
                              </td>
                              <td className="py-2.5 text-xs text-slate-500 whitespace-nowrap">
                                {firstDuty ? `${fmt(firstDuty.startTime)} – ${fmt(firstDuty.endTime)}` : '—'}
                              </td>
                              <td className="py-2.5">
                                <div className="flex flex-wrap gap-1">
                                  {emp.duties.map((d, i) => (
                                    <span key={i} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${DUTY_COLORS[d.duty] ?? 'bg-slate-100 text-slate-600'}`}>
                                      {d.duty}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-2.5">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[firstDuty?.status] ?? 'bg-slate-50 text-slate-500'}`}>
                                  {firstDuty?.status}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
