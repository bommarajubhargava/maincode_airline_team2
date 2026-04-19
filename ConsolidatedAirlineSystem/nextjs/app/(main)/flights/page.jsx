'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import FlightDutyForm from '@/components/FlightDutyForm'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const todayStr = () => new Date().toISOString().slice(0, 10)

function statusBadge(status) {
  if (status === 'Completed') return <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">Completed ✓</span>
  if (status === 'Cancelled') return <span className="text-xs font-semibold bg-red-100 text-red-600 px-2.5 py-1 rounded-full">Cancelled</span>
  return <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">Scheduled</span>
}

function FlightCard({ flight, viewOnly, isManager, onRefresh }) {
  const [open, setOpen]       = useState(false)
  const [detail, setDetail]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [cForm, setCForm]     = useState({ checked: false, notes: '' })
  const [submitting, setSubmitting] = useState(false)

  const loadDetail = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/flights/${flight.id}`)
      setDetail(await res.json())
    } catch { toast.error('Failed to load duties') }
    finally { setLoading(false) }
  }, [flight.id])

  const toggle = () => {
    if (!open && !detail) loadDetail()
    setOpen(o => !o)
  }

  const doneCount   = detail?.duties?.filter(d => d.completed).length ?? 0
  const total       = detail?.duties?.length ?? 0
  const pct         = total > 0 ? Math.round((doneCount / total) * 100) : 0
  const allDone     = total > 0 && doneCount === total
  const isCancelled = flight.status === 'Cancelled'
  const isDone      = flight.status === 'Completed'
  const canComplete = isManager && allDone && !isCancelled && !isDone

  const handleComplete = async () => {
    if (!cForm.checked) { toast.error('Please check the confirmation first'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/flights/${flight.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Completed', completionNotes: cForm.notes }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.message) }
      toast.success(`${flight.flight_number} marked as completed`)
      onRefresh()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  return (
    <div className={`rounded-xl border transition-all ${isCancelled ? 'border-red-100 bg-red-50' : isDone ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
      {/* Flight summary row */}
      <button onClick={toggle} className="w-full flex flex-wrap items-center gap-4 p-4 text-left hover:bg-black/[0.02] rounded-xl">
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className="font-bold text-slate-800">{flight.flight_number}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${flight.flight_type === 'Departing' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
              {flight.flight_type === 'Departing' ? '↑' : '↓'} {flight.flight_type}
            </span>
            {statusBadge(flight.status)}
          </div>
          <p className="text-sm text-slate-600">{flight.from_airport} → {flight.to_airport}</p>
          <p className="text-xs text-slate-500">{flight.aircraft} · {flight.passenger_count} pax · {new Date(flight.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        {!isCancelled && !isDone && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap">{doneCount}/{total} duties</span>
            <span className="text-slate-400 text-sm">{open ? '▲' : '▼'}</span>
          </div>
        )}
        {(isCancelled || isDone) && <span className="text-slate-400 text-sm shrink-0">{open ? '▲' : '▼'}</span>}
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
          {isCancelled ? (
            <p className="text-sm text-red-500 py-4 text-center">This flight has been cancelled. No actions available.</p>
          ) : isDone ? (
            <>
              <p className="text-sm text-emerald-600 py-3 text-center font-medium">Flight completed — all duties fulfilled.</p>
              {detail?.flight?.completion_notes && (
                <p className="text-xs text-slate-500 text-center mb-2">Notes: {detail.flight.completion_notes}</p>
              )}
              {loading && <p className="text-sm text-slate-400 text-center py-2">Loading…</p>}
              {detail?.duties && (
                <div className="space-y-2 mt-2">
                  {detail.duties.map(duty => (
                    <FlightDutyForm key={duty.key} duty={duty} flightId={flight.id} viewOnly={true} onCompleted={() => {}} />
                  ))}
                </div>
              )}
            </>
          ) : viewOnly ? (
            <>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                Future flight — view only. Duties cannot be submitted yet.
              </p>
              {loading && <p className="text-sm text-slate-400 text-center py-4">Loading…</p>}
              {detail?.duties && (
                <div className="space-y-2">
                  {detail.duties.map(duty => (
                    <FlightDutyForm key={duty.key} duty={duty} flightId={flight.id} viewOnly={true} onCompleted={() => {}} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {loading && <p className="text-sm text-slate-400 text-center py-4">Loading duties…</p>}
              {detail?.duties && (
                <div className="space-y-2">
                  {detail.duties.map(duty => (
                    <FlightDutyForm key={duty.key} duty={duty} flightId={flight.id} viewOnly={false} onCompleted={() => { loadDetail(); onRefresh() }} />
                  ))}
                </div>
              )}

              {/* Manager-only flight completion section */}
              {isManager && (
                <div className="mt-5 pt-4 border-t border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Flight Completion</p>
                  {!allDone && total > 0 && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                      {doneCount}/{total} duties completed — finish all duties before marking as done.
                    </p>
                  )}
                  <label className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${cForm.checked ? 'bg-emerald-50 border-emerald-300' : canComplete ? 'bg-white border-slate-300 hover:border-emerald-300 cursor-pointer' : 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-60'}`}>
                    <input type="checkbox"
                      checked={cForm.checked}
                      disabled={!canComplete}
                      onChange={e => setCForm(f => ({ ...f, checked: e.target.checked }))}
                      className="w-4 h-4 accent-emerald-600 shrink-0" />
                    <span className={`text-sm font-semibold ${cForm.checked ? 'text-emerald-700' : canComplete ? 'text-slate-800' : 'text-slate-400'}`}>
                      {flight.flight_type === 'Departing' ? 'Ready for Departure' : 'Arrival Completed'}
                    </span>
                  </label>
                  <textarea
                    value={cForm.notes}
                    disabled={!canComplete}
                    onChange={e => setCForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Completion notes (optional)…"
                    rows={2}
                    className={`input-field mt-3 resize-none text-sm w-full ${!canComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={handleComplete}
                      disabled={!canComplete || !cForm.checked || submitting}
                      className="btn-primary text-sm px-6 disabled:opacity-50 disabled:cursor-not-allowed">
                      {submitting ? 'Submitting…' : flight.flight_type === 'Departing' ? 'Submit — Ready for Departure' : 'Submit — Arrival Completed'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function FlightsPage() {
  const { user }   = useAuth()
  const [tab, setTab]           = useState('Departing')
  const [flights, setFlights]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [searchDate, setSearchDate]   = useState(todayStr())
  const [searchFlight, setSearchFlight] = useState('')

  const isManager  = ['Manager', 'Admin'].includes(user?.role)
  const isToday    = searchDate === todayStr()
  const isFuture   = searchDate > todayStr()

  const fetchFlights = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchDate) params.set('date', searchDate)
      if (searchFlight.trim()) params.set('flightNumber', searchFlight.trim())
      const res  = await fetch(`/api/flights?${params}`)
      const data = await res.json()
      setFlights(Array.isArray(data) ? data : [])
    } catch { toast.error('Failed to load flights') }
    finally { setLoading(false) }
  }, [searchDate, searchFlight])

  useEffect(() => { fetchFlights() }, [fetchFlights])

  const displayed = flights.filter(f => f.flight_type === tab)
  const depCount  = flights.filter(f => f.flight_type === 'Departing').length
  const arrCount  = flights.filter(f => f.flight_type === 'Arriving').length

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-800">Flight Duties</h1>
        <p className="text-slate-500 text-sm">{user?.name} · {user?.role}</p>
      </div>

      {/* Search bar */}
      <div className="card mb-5">
        <div className="grid sm:grid-cols-[1fr_160px_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Flight Number</label>
            <input value={searchFlight} onChange={e => setSearchFlight(e.target.value)}
              placeholder="e.g. SW101" className="input-field" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Date</label>
            <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)} className="input-field" />
          </div>
          <button onClick={fetchFlights} className="btn-primary text-sm">Search</button>
        </div>
        {isFuture && !isManager && (
          <p className="mt-2 text-xs text-amber-600">Future date selected — duties are view-only.</p>
        )}
        {!isToday && !isFuture && (
          <p className="mt-2 text-xs text-slate-500">Past date — viewing historical flights.</p>
        )}
      </div>

      {/* Dep / Arr tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl w-fit">
        {[{ label: 'Departing', icon: '↑', count: depCount }, { label: 'Arriving', icon: '↓', count: arrCount }].map(({ label, icon, count }) => (
          <button key={label} onClick={() => setTab(label)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === label ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
            {icon} {label}
            <span className={`text-xs px-1.5 rounded-full ${tab === label ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>{count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center"><div className="text-4xl mb-3">✈️</div><p className="text-slate-500">Loading flights…</p></div>
        </div>
      ) : displayed.length === 0 ? (
        <div className="card text-center py-10 text-slate-500">
          <p className="text-3xl mb-2">{tab === 'Departing' ? '↑' : '↓'}</p>
          <p>No {tab.toLowerCase()} flights found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(f => (
            <FlightCard key={f.id} flight={f} viewOnly={isFuture && !isManager} isManager={isManager} onRefresh={fetchFlights} />
          ))}
        </div>
      )}
    </div>
  )
}
