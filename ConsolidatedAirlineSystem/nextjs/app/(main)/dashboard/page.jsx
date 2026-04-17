'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/context/AuthContext'
import { shiftService } from '@/lib/api'
import ShiftCalendar from '@/components/ShiftCalendar'
import ShiftCard from '@/components/ShiftCard'
import ShiftDetailModal from '@/components/ShiftDetailModal'
import RequestForm from '@/components/RequestForm'
import RequestQueue from '@/components/RequestQueue'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const TABS = ['Calendar', 'Shifts List', 'My Requests']

const TYPE_BG   = { Morning: 'bg-amber-50 border-amber-200', Afternoon: 'bg-sky-50 border-sky-200', Night: 'bg-indigo-50 border-indigo-200' }
const TYPE_ICON = { Morning: '🌅', Afternoon: '☀️', Night: '🌙' }
const STATUS_BADGE = { Scheduled: 'badge-scheduled', Completed: 'badge-completed', Cancelled: 'badge-cancelled', Swapped: 'badge-swapped' }

export default function DashboardPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab]       = useState('Calendar')
  const [shifts, setShifts]             = useState([])
  const [requests, setRequests]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [days, setDays]                 = useState(30)
  const [detailShift, setDetailShift]   = useState(null)
  const [requestForm, setRequestForm]   = useState(null)

  // Day panel state
  const [selectedDay, setSelectedDay]   = useState(null)
  const [dayShifts, setDayShifts]       = useState([])
  const [dayLoading, setDayLoading]     = useState(false)
  const [panelShift, setPanelShift]     = useState(null)  // selected employee in right panel

  const fetchData = async () => {
    try {
      const [s, r] = await Promise.all([shiftService.getMyShifts(days), shiftService.getMyRequests()])
      setShifts(s); setRequests(r)
    } catch { toast.error('Failed to load data') }
    finally { setLoading(false) }
  }

  useEffect(() => { setLoading(true); fetchData() }, [days])

  const handleDayClick = async (day) => {
    setSelectedDay(day)
    setPanelShift(null)
    setDayLoading(true)
    try {
      const dateStr = format(day, 'yyyy-MM-dd')
      const res = await fetch(`/api/shifts/day?date=${dateStr}`)
      const data = await res.json()
      setDayShifts(data)
      if (data.length > 0) setPanelShift(data[0])
    } catch { toast.error('Failed to load day shifts') }
    finally { setDayLoading(false) }
  }

  const stats = {
    total:     shifts.length,
    scheduled: shifts.filter(s => s.status === 'Scheduled').length,
    completed: shifts.filter(s => s.status === 'Completed').length,
    cancelled: shifts.filter(s => s.status === 'Cancelled').length,
    swapped:   shifts.filter(s => s.status === 'Swapped').length,
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-center"><div className="text-4xl mb-3">✈️</div><p className="text-slate-500">Loading your shifts...</p></div></div>

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Dashboard</h1>
          <p className="text-slate-500 text-sm">{user?.name} · {user?.role} · {user?.department}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Show next:</label>
          <select value={days} onChange={e => setDays(Number(e.target.value))} className="input-field w-auto">
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total',     value: stats.total,     color: 'text-blue-700 bg-blue-50' },
          { label: 'Scheduled', value: stats.scheduled, color: 'text-emerald-700 bg-emerald-50' },
          { label: 'Completed', value: stats.completed, color: 'text-slate-600 bg-slate-100' },
          { label: 'Cancelled', value: stats.cancelled, color: 'text-red-600 bg-red-50' },
          { label: 'Swapped',   value: stats.swapped,   color: 'text-teal-700 bg-teal-50' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color.split(' ')[1]}`}>
            <p className={`text-2xl font-bold ${s.color.split(' ')[0]}`}>{s.value}</p>
            <p className="text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
            {tab}
            {tab === 'My Requests' && requests.filter(r => r.status === 'Pending').length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{requests.filter(r => r.status === 'Pending').length}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'Calendar' && (
        <>
          <ShiftCalendar
            shifts={shifts}
            onShiftClick={s => setDetailShift(s)}
            onDayClick={handleDayClick}
          />

          {/* Day panel — fixed overlay from right */}
          {selectedDay && createPortal(
            <>
              {/* backdrop */}
              <div onClick={() => { setSelectedDay(null); setDayShifts([]); setPanelShift(null) }}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 9998 }} />

              {/* panel — rendered into document.body via portal, no parent CSS interference */}
              <div style={{
                position: 'fixed', top: '20vh', left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
                width: '660px', maxWidth: 'calc(100vw - 32px)',
                background: '#ffffff', borderRadius: '16px',
                border: '1px solid #e2e8f0', boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
              }}>
                {/* header */}
                <div style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', borderRadius: '16px 16px 0 0' }}>
                  <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.9rem' }}>
                    📅 {format(selectedDay, 'EEEE, MMMM d, yyyy')}
                    <span style={{ marginLeft: '8px', fontSize: '0.8rem', fontWeight: 400, color: '#94a3b8' }}>{dayShifts.length} shifts</span>
                  </span>
                  <button onClick={() => { setSelectedDay(null); setDayShifts([]); setPanelShift(null) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '20px', lineHeight: 1, padding: 0 }}>✕</button>
                </div>

                {/* body — hard 300px, clips everything inside */}
                <div style={{ height: '300px', display: 'flex', overflow: 'hidden', borderRadius: '0 0 16px 16px' }}>
                  {dayLoading ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Loading...</div>
                  ) : dayShifts.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>No shifts scheduled.</div>
                  ) : (
                    <>
                      {/* LEFT — 220px wide, 300px tall, absolute-positioned scroll area */}
                      <div style={{ width: '220px', height: '300px', flexShrink: 0, borderRight: '1px solid #e2e8f0', position: 'relative' }}>
                        {/* sub-header pinned at top */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '32px', display: 'flex', alignItems: 'center', padding: '0 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', zIndex: 1 }}>
                          Employees ({dayShifts.length})
                        </div>
                        {/* scroll area fills exactly 300-32=268px, always */}
                        <div style={{ position: 'absolute', top: '32px', left: 0, right: 0, bottom: 0, overflowY: 'scroll' }}>
                          {dayShifts.map(s => (
                            <div key={s.id} onClick={() => setPanelShift(s)}
                              style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', borderLeft: `4px solid ${panelShift?.id === s.id ? '#3b82f6' : 'transparent'}`, background: panelShift?.id === s.id ? '#eff6ff' : '#fff', cursor: 'pointer' }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.userName || 'Staff Member'}</div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>{s.employeeId} · {s.role}</div>
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{s.shiftType} · {format(new Date(s.startTime), 'HH:mm')}–{format(new Date(s.endTime), 'HH:mm')}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* RIGHT — flex fill, scrollable details */}
                      <div style={{ flex: 1, height: '300px', overflowY: 'auto', padding: '16px' }}>
                        {panelShift ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                                {(panelShift.userName || 'S')[0]}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">{panelShift.userName || 'Staff Member'}</p>
                                <p className="text-xs text-slate-500">{panelShift.employeeId} · {panelShift.role} · {panelShift.department}</p>
                              </div>
                            </div>
                            <div className={`rounded-xl border p-4 ${TYPE_BG[panelShift.shiftType] || 'bg-slate-50 border-slate-200'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xl">{TYPE_ICON[panelShift.shiftType] || '🕐'}</span>
                                <span className="font-bold text-slate-800">{panelShift.shiftType} Shift</span>
                              </div>
                              <span className={STATUS_BADGE[panelShift.status] || 'badge-scheduled'}>{panelShift.status}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-slate-50 rounded-xl p-3">
                                <p className="text-xs text-slate-400 font-medium mb-1">🕐 Time</p>
                                <p className="text-sm font-semibold text-slate-700">{format(new Date(panelShift.startTime), 'HH:mm')} – {format(new Date(panelShift.endTime), 'HH:mm')}</p>
                              </div>
                              <div className="bg-slate-50 rounded-xl p-3">
                                <p className="text-xs text-slate-400 font-medium mb-1">📍 Location</p>
                                <p className="text-sm font-semibold text-slate-700 truncate">{panelShift.location}</p>
                              </div>
                              <div className="bg-slate-50 rounded-xl p-3">
                                <p className="text-xs text-slate-400 font-medium mb-1">🪪 Shift ID</p>
                                <p className="text-xs font-mono text-slate-500">{panelShift.id}</p>
                              </div>
                              {panelShift.duty && (
                                <div className="bg-slate-50 rounded-xl p-3">
                                  <p className="text-xs text-slate-400 font-medium mb-1">🎯 Duty</p>
                                  <p className="text-sm font-semibold text-slate-700">{panelShift.duty}</p>
                                </div>
                              )}
                            </div>
                            {panelShift.userId === user?.id && panelShift.status === 'Scheduled' && (
                              <div className="pt-3 border-t border-slate-100">
                                <p className="text-xs text-slate-400 font-medium mb-3">REQUEST AN ACTION</p>
                                <div className="grid grid-cols-3 gap-2">
                                  {[
                                    { type: 'Cancellation', icon: '🚫', label: 'Cancel', cls: 'border-red-200 bg-red-50 hover:bg-red-100 text-red-700' },
                                    { type: 'Change',       icon: '✏️', label: 'Change', cls: 'border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700' },
                                    { type: 'Swap',         icon: '🔄', label: 'Swap',   cls: 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700' },
                                  ].map(a => (
                                    <button key={a.type} onClick={() => setRequestForm({ shift: panelShift, requestType: a.type })}
                                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors ${a.cls}`}>
                                      <span className="text-xl">{a.icon}</span>
                                      <span className="text-xs font-semibold">{a.label}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '14px' }}>
                            Select an employee to view details
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>,
            document.body
          )}
        </>
      )}

      {activeTab === 'Shifts List' && (
        shifts.length === 0
          ? <div className="text-center py-16 text-slate-400"><p className="text-4xl mb-2">📅</p><p>No shifts in this period</p></div>
          : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {shifts.map(s => <ShiftCard key={s.id} shift={s} onRequestAction={(shift, type) => setRequestForm({ shift, requestType: type })} />)}
            </div>
      )}

      {activeTab === 'My Requests' && (
        <RequestQueue requests={requests} onRefresh={fetchData} readOnly={true} />
      )}

      {detailShift && (
        <ShiftDetailModal
          shift={detailShift}
          onClose={() => setDetailShift(null)}
          onAction={(shift, type) => {
            setDetailShift(null)
            setRequestForm({ shift, requestType: type })
          }}
        />
      )}

      {requestForm && (
        <RequestForm shift={requestForm.shift} requestType={requestForm.requestType}
          onClose={() => setRequestForm(null)} onSubmitted={fetchData} />
      )}
    </div>
  )
}
