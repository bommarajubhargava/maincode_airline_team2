'use client'
import { useState, useEffect, useCallback } from 'react'
import FlightDutyForm from '@/components/FlightDutyForm'
import toast from 'react-hot-toast'

const todayStr = () => new Date().toISOString().slice(0, 10)

const HOME_AIRPORTS = ['All', 'YYZ', 'YTZ', 'YHM']

function statusBadge(status) {
  if (status === 'Completed') return <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">Completed ✓</span>
  if (status === 'Cancelled') return <span className="text-xs font-semibold bg-red-100 text-red-600 px-2.5 py-1 rounded-full">Cancelled</span>
  return <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">Scheduled</span>
}

function AdminFlightCard({ flight }) {
  const [open, setOpen]       = useState(false)
  const [detail, setDetail]   = useState(null)
  const [loading, setLoading] = useState(false)

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

  const doneCount = detail?.duties?.filter(d => d.completed).length ?? 0
  const total     = detail?.duties?.length ?? 0
  const pct       = total > 0 ? Math.round((doneCount / total) * 100) : 0

  return (
    <div className={`rounded-xl border transition-all ${flight.status === 'Cancelled' ? 'border-red-100 bg-red-50' : flight.status === 'Completed' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
      <button onClick={toggle} className="w-full flex flex-wrap items-center gap-4 p-4 text-left hover:bg-black/[0.02] rounded-xl">
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className="font-bold text-slate-800">{flight.flight_number}</span>
            <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{flight.airport_id}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${flight.flight_type === 'Departing' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
              {flight.flight_type === 'Departing' ? '↑' : '↓'} {flight.flight_type}
            </span>
            {statusBadge(flight.status)}
          </div>
          <p className="text-sm text-slate-600">{flight.from_airport} → {flight.to_airport}</p>
          <p className="text-xs text-slate-500">{flight.aircraft} · {flight.passenger_count} pax · {new Date(flight.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {flight.status === 'Scheduled' && (
            <>
              <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-amber-400' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-slate-500 whitespace-nowrap">{doneCount}/{total} duties</span>
            </>
          )}
          <span className="text-slate-400 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
          {loading && <p className="text-sm text-slate-400 text-center py-4">Loading duties…</p>}

          {detail?.duties && (
            <>
              {flight.status === 'Completed' && detail?.flight?.completion_notes && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-3">
                  Completion notes: {detail.flight.completion_notes}
                </p>
              )}
              <div className="space-y-2">
                {detail.duties.map(duty => (
                  <FlightDutyForm
                    key={duty.key}
                    duty={duty}
                    flightId={flight.id}
                    viewOnly={true}
                    onCompleted={() => {}}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminFlightsPage() {
  const [airport, setAirport]         = useState('All')
  const [date, setDate]               = useState(todayStr())
  const [flightNum, setFlightNum]     = useState('')
  const [flights, setFlights]         = useState([])
  const [loading, setLoading]         = useState(false)
  const [searched, setSearched]       = useState(false)

  const fetchFlights = useCallback(async () => {
    setLoading(true)
    setSearched(true)
    try {
      const params = new URLSearchParams()
      if (airport !== 'All') params.set('airport', airport)
      if (date)     params.set('date', date)
      if (flightNum.trim()) params.set('flightNumber', flightNum.trim())
      const res  = await fetch(`/api/flights?${params}`)
      const data = await res.json()
      setFlights(Array.isArray(data) ? data : [])
    } catch { toast.error('Failed to load flights') }
    finally { setLoading(false) }
  }, [airport, date, flightNum])

  useEffect(() => { fetchFlights() }, [fetchFlights])

  const depFlights = flights.filter(f => f.flight_type === 'Departing')
  const arrFlights = flights.filter(f => f.flight_type === 'Arriving')

  const completedCount  = flights.filter(f => f.status === 'Completed').length
  const scheduledCount  = flights.filter(f => f.status === 'Scheduled').length
  const cancelledCount  = flights.filter(f => f.status === 'Cancelled').length

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-800">Flight Overview</h1>
        <p className="text-slate-500 text-sm">All airports · view only</p>
      </div>

      {/* Search bar */}
      <div className="card mb-5">
        <div className="grid sm:grid-cols-[auto_1fr_160px_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Airport</label>
            <select value={airport} onChange={e => setAirport(e.target.value)} className="input-field">
              {HOME_AIRPORTS.map(a => <option key={a} value={a}>{a === 'All' ? 'All Airports' : a}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Flight Number</label>
            <input value={flightNum} onChange={e => setFlightNum(e.target.value)}
              placeholder="e.g. AC101" className="input-field" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field" />
          </div>
          <button onClick={fetchFlights} className="btn-primary text-sm">Search</button>
        </div>
      </div>

      {/* Summary pills */}
      {searched && !loading && flights.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { label: `${flights.length} total`,    color: 'bg-slate-100 text-slate-700' },
            { label: `${scheduledCount} scheduled`, color: 'bg-blue-100 text-blue-700' },
            { label: `${completedCount} completed`, color: 'bg-emerald-100 text-emerald-700' },
            { label: `${cancelledCount} cancelled`, color: 'bg-red-100 text-red-600' },
          ].map(p => <span key={p.label} className={`text-xs font-semibold px-3 py-1 rounded-full ${p.color}`}>{p.label}</span>)}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-slate-500">Loading flights…</p>
        </div>
      ) : flights.length === 0 && searched ? (
        <div className="card text-center py-10 text-slate-500">No flights found</div>
      ) : (
        <div className="space-y-6">
          {depFlights.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">↑ Departing ({depFlights.length})</p>
              <div className="space-y-2">
                {depFlights.map(f => <AdminFlightCard key={f.id} flight={f} />)}
              </div>
            </div>
          )}
          {arrFlights.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">↓ Arriving ({arrFlights.length})</p>
              <div className="space-y-2">
                {arrFlights.map(f => <AdminFlightCard key={f.id} flight={f} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
