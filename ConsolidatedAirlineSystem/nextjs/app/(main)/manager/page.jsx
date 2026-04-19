'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { shiftService, complianceService } from '@/lib/api'
import ShiftCard from '@/components/ShiftCard'
import RequestQueue from '@/components/RequestQueue'
import CompliancePanel from '@/components/CompliancePanel'
import SchedulingEngine from '@/components/SchedulingEngine'
import ShiftAssignPanel from '@/components/ShiftAssignPanel'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const TABS = ['All Shifts', 'Requests', 'Staff List', 'Compliance', 'Flights Today', 'Scheduling']

export default function ManagerPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('All Shifts')
  const [shifts, setShifts] = useState([])
  const [requests, setRequests] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterName, setFilterName]       = useState('All')
  const [filterFromDate, setFilterFromDate] = useState('')
  const [filterToDate, setFilterToDate]   = useState('')
  const [filterType, setFilterType]       = useState('All')
  const [filterStatus, setFilterStatus]   = useState('All')
  const [appliedFilters, setAppliedFilters] = useState({ name: 'All', from: '', to: '', type: 'All', status: 'All' })
  const [editShift, setEditShift] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [compliance, setCompliance] = useState(null)
  const [complianceLoading, setComplianceLoading] = useState(false)
  const [flights, setFlights] = useState([])
  const [flightDetails, setFlightDetails] = useState({})
  const [flightsLoading, setFlightsLoading] = useState(false)
  const [flightTab, setFlightTab] = useState('Departing')

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [s, r, u] = await Promise.all([shiftService.getAllShifts(), shiftService.getAllRequests(), shiftService.getUsers()])
      setShifts(s); setRequests(r); setUsers(u)
    } catch { toast.error('Failed to load data') }
    finally { setLoading(false) }
  }

  const fetchCompliance = async () => {
    setComplianceLoading(true)
    try {
      const report = await complianceService.getReport()
      setCompliance(report)
    } catch {
      toast.error('Failed to load compliance report')
    } finally {
      setComplianceLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    if (activeTab === 'Compliance' && !compliance) fetchCompliance()
    if (activeTab === 'Flights Today' && flights.length === 0) fetchFlightsToday()
  }, [activeTab])

  const fetchFlightsToday = async () => {
    setFlightsLoading(true)
    try {
      const res  = await fetch('/api/flights?today=true')
      const data = await res.json()
      setFlights(data)
      // Load duty status for each flight
      const details = {}
      await Promise.all(data.map(async f => {
        const r = await fetch(`/api/flights/${f.id}`)
        details[f.id] = await r.json()
      }))
      setFlightDetails(details)
    } catch { toast.error('Failed to load flights') }
    finally { setFlightsLoading(false) }
  }

  const openEdit = (s) => {
    setEditShift(s)
    setEditForm({
      startTime: format(new Date(s.startTime), "yyyy-MM-dd'T'HH:mm"),
      endTime:   format(new Date(s.endTime),   "yyyy-MM-dd'T'HH:mm"),
      location: s.location, shiftType: s.shiftType, status: s.status,
    })
  }

  const handleEditSave = async () => {
    try {
      await shiftService.updateShift(editShift.id, editForm)
      toast.success('Shift updated')
      setEditShift(null); fetchAll()
    } catch (err) { toast.error(err.message) }
  }

  const pendingCount = requests.filter(r => r.status === 'Pending').length

  const af = appliedFilters
  const filteredShifts = shifts.filter(s => {
    const dateStr = format(new Date(s.startTime), 'yyyy-MM-dd')
    return (
      (af.name   === 'All' || s.userName === af.name) &&
      (!af.from            || dateStr >= af.from) &&
      (!af.to              || dateStr <= af.to) &&
      (af.type   === 'All' || s.shiftType === af.type) &&
      (af.status === 'All' || s.status === af.status)
    )
  })

  const hasActiveFilters = af.name !== 'All' || af.from || af.to || af.type !== 'All' || af.status !== 'All'

  const handleSearch = () => setAppliedFilters({ name: filterName, from: filterFromDate, to: filterToDate, type: filterType, status: filterStatus })

  const handleClearFilters = () => {
    setFilterName('All'); setFilterFromDate(''); setFilterToDate(''); setFilterType('All'); setFilterStatus('All')
    setAppliedFilters({ name: 'All', from: '', to: '', type: 'All', status: 'All' })
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-center"><div className="text-4xl mb-3">✈️</div><p className="text-slate-500">Loading...</p></div></div>

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manager Dashboard</h1>
          <p className="text-slate-500 text-sm">{user?.name} · {user?.role}</p>
        </div>
        <div className="flex gap-3">
          {[
            { label: 'Total Shifts', value: shifts.length, color: 'text-blue-700' },
            { label: 'Pending',      value: pendingCount,  color: 'text-amber-600' },
            { label: 'Staff',        value: users.length,  color: 'text-slate-700' },
            { label: 'Violations',   value: compliance?.summary?.totalCritical ?? '—', color: compliance?.summary?.totalCritical > 0 ? 'text-red-600' : 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="card py-3 px-5 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
            {tab}
            {tab === 'Requests' && pendingCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>
            )}
            {tab === 'Compliance' && compliance?.summary?.totalCritical > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{compliance.summary.totalCritical}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'All Shifts' && (
        <div>
          <div className="card mb-5">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div><label className="text-xs font-medium text-slate-500 block mb-1">Employee</label>
                <select value={filterName} onChange={e => setFilterName(e.target.value)} className="input-field">
                  <option value="All">All Employees</option>
                  {[...new Set(shifts.map(s => s.userName).filter(Boolean))].sort().map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div><label className="text-xs font-medium text-slate-500 block mb-1">From Date</label>
                <input type="date" value={filterFromDate} onChange={e => setFilterFromDate(e.target.value)} className="input-field" /></div>
              <div><label className="text-xs font-medium text-slate-500 block mb-1">To Date</label>
                <input type="date" value={filterToDate} onChange={e => setFilterToDate(e.target.value)} className="input-field" /></div>
              <div><label className="text-xs font-medium text-slate-500 block mb-1">Type</label>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-field">
                  <option value="All">All Types</option>
                  {['Morning','Afternoon','Evening','Night'].map(t => <option key={t}>{t}</option>)}
                </select></div>
              <div><label className="text-xs font-medium text-slate-500 block mb-1">Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field">
                  <option value="All">All Status</option>
                  {['Scheduled','Completed','Cancelled','Swapped'].map(s => <option key={s}>{s}</option>)}
                </select></div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <button onClick={handleSearch} className="btn-primary text-sm py-1.5 px-4">Search</button>
                {hasActiveFilters && (
                  <button onClick={handleClearFilters} className="text-xs text-blue-600 hover:text-blue-800">Clear filters</button>
                )}
              </div>
              {hasActiveFilters && (
                <p className="text-xs text-slate-400">
                  {af.from && af.to ? `${af.from} → ${af.to}` : af.from ? `From ${af.from}` : af.to ? `Until ${af.to}` : ''}
                </p>
              )}
            </div>
          </div>
          <p className="text-sm text-slate-500 mb-3">
            {filteredShifts.length} shift{filteredShifts.length !== 1 ? 's' : ''}
            {hasActiveFilters && <span className="text-slate-400"> (filtered from {shifts.length} total)</span>}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredShifts.map(s => (
              <div key={s.id} className="relative">
                <ShiftCard shift={s} showUser={true} />
                <button onClick={() => openEdit(s)} className="absolute top-3 right-3 text-slate-400 hover:text-blue-600 text-sm" title="Edit">✏️</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Requests' && <RequestQueue requests={requests} onRefresh={fetchAll} />}

      {activeTab === 'Compliance' && (
        <CompliancePanel
          data={compliance}
          loading={complianceLoading}
          onRefresh={fetchCompliance}
        />
      )}

      {activeTab === 'Scheduling' && <SchedulingEngine />}

      {activeTab === 'Staff List' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Employee','ID','Email','Role','Department','Shifts'].map(h => (
                  <th key={h} className={`pb-3 font-semibold text-slate-500 ${h === 'Shifts' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-3 font-medium">{u.name}</td>
                  <td className="py-3 text-slate-500">{u.employeeId}</td>
                  <td className="py-3 text-slate-500">{u.email}</td>
                  <td className="py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.role === 'Manager' ? 'bg-purple-100 text-purple-700' : u.role === 'Agent' ? 'bg-sky-100 text-sky-700' : 'bg-blue-100 text-blue-700'}`}>{u.role}</span>
                  </td>
                  <td className="py-3 text-slate-500">{u.department}</td>
                  <td className="py-3 text-right">{shifts.filter(s => s.userId === u.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'Flights Today' && (
        <div>
          <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl w-fit">
            {['Departing', 'Arriving'].map(type => {
              const cnt = flights.filter(f => f.flight_type === type).length
              return (
                <button key={type} onClick={() => setFlightTab(type)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${flightTab === type ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
                  {type === 'Departing' ? '↑' : '↓'} {type}
                  <span className={`text-xs px-1.5 rounded-full ${flightTab === type ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>{cnt}</span>
                </button>
              )
            })}
            <button onClick={fetchFlightsToday} className="ml-2 text-xs text-blue-600 hover:text-blue-800 px-2">↻ Refresh</button>
          </div>

          {flightsLoading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-slate-500">Loading flights…</p>
            </div>
          ) : (
            <div className="space-y-4">
              {flights.filter(f => f.flight_type === flightTab).map(flight => {
                const detail    = flightDetails[flight.id]
                const doneCount = detail?.duties?.filter(d => d.completed).length ?? 0
                const total     = detail?.duties?.length ?? 0
                const pct       = total > 0 ? Math.round((doneCount / total) * 100) : 0
                const allDone     = pct === 100
                const isCancelled = flight.status === 'Cancelled'
                const isCompleted = flight.status === 'Completed'

                return (
                  <div key={flight.id} className={`card border ${isCancelled ? 'border-red-200 bg-red-50' : isCompleted ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200'}`}>
                    {/* Header */}
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-lg font-bold text-slate-800">{flight.flight_number}</span>
                          {isCancelled && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Cancelled</span>}
                          {isCompleted && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Completed ✓</span>}
                          {!isCancelled && !isCompleted && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${allDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {allDone ? 'All Duties Done' : 'In Progress'}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 text-sm">{flight.from_airport} → {flight.to_airport}</p>
                        <p className="text-slate-500 text-xs">{flight.aircraft} · {flight.passenger_count} pax · {new Date(flight.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${isCompleted ? 'text-emerald-700' : isCancelled ? 'text-red-500' : 'text-slate-800'}`}>{pct}%</p>
                        <p className="text-xs text-slate-500">{doneCount}/{total} duties</p>
                        <div className="mt-1 w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${isCompleted ? 'bg-emerald-500' : allDone ? 'bg-emerald-500' : pct > 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Duty cards with responsible staff */}
                    {detail?.duties && (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {detail.duties.map(duty => (
                          <div key={duty.key}
                            className={`p-3 rounded-lg border text-xs ${duty.completed ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span>{duty.icon}</span>
                              <span className={`font-semibold ${duty.completed ? 'text-emerald-700' : 'text-slate-700'}`}>{duty.label}</span>
                              {duty.completed && <span className="ml-auto text-emerald-600">✓ Done</span>}
                            </div>
                            {duty.responsibleStaff?.length > 0 ? (
                              <div className="space-y-1 pl-6">
                                {duty.responsibleStaff.map(s => (
                                  <div key={s.id} className="text-slate-500">
                                    <span className="font-medium text-slate-600">{s.employee_id}</span> · {s.name} · {s.email}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="pl-6 text-slate-400 italic">No staff assigned</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {isCompleted && detail?.flight?.completion_notes && (
                      <div className="mt-3 pt-3 border-t border-emerald-200 text-xs text-emerald-700">
                        <span className="font-semibold">Notes:</span> {detail.flight.completion_notes}
                      </div>
                    )}
                  </div>
                )
              })}
              {flights.filter(f => f.flight_type === flightTab).length === 0 && (
                <div className="card text-center py-10 text-slate-500">No {flightTab.toLowerCase()} flights today</div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'Assign Shifts' && (
        <ShiftAssignPanel employees={users} lockedAirportId={user?.airportId} onAssigned={fetchAll} />
      )}

      {editShift && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">Edit Shift</h2>
              <button onClick={() => setEditShift(null)} className="text-slate-400 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500">
                <p className="font-semibold text-slate-700">{editShift.userName} · {editShift.employeeId}</p>
                <p>ID: {editShift.id}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Start</label>
                  <input type="datetime-local" value={editForm.startTime} onChange={e => setEditForm(f => ({ ...f, startTime: e.target.value }))} className="input-field" /></div>
                <div><label className="text-xs font-medium text-slate-600 mb-1 block">End</label>
                  <input type="datetime-local" value={editForm.endTime} onChange={e => setEditForm(f => ({ ...f, endTime: e.target.value }))} className="input-field" /></div>
              </div>
              <div><label className="text-xs font-medium text-slate-600 mb-1 block">Location</label>
                <input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} className="input-field" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Type</label>
                  <select value={editForm.shiftType} onChange={e => setEditForm(f => ({ ...f, shiftType: e.target.value }))} className="input-field">
                    {['Morning','Afternoon','Evening','Night'].map(t => <option key={t}>{t}</option>)}
                  </select></div>
                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
                  <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className="input-field">
                    {['Scheduled','Completed','Cancelled','Swapped'].map(s => <option key={s}>{s}</option>)}
                  </select></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditShift(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleEditSave} className="btn-primary flex-1">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
