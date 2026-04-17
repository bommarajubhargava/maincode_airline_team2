'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { shiftService } from '@/lib/api'
import ShiftCalendar from '@/components/ShiftCalendar'
import ShiftCard from '@/components/ShiftCard'
import ShiftDetailModal from '@/components/ShiftDetailModal'
import RequestForm from '@/components/RequestForm'
import RequestQueue from '@/components/RequestQueue'
import toast from 'react-hot-toast'

const TABS = ['Calendar', 'Shifts List', 'My Requests']

export default function DashboardPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('Calendar')
  const [shifts, setShifts] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [detailShift, setDetailShift] = useState(null)   // calendar click → show detail
  const [requestForm, setRequestForm] = useState(null)   // detail action → show request form

  const fetchData = async () => {
    try {
      const [s, r] = await Promise.all([shiftService.getMyShifts(days), shiftService.getMyRequests()])
      setShifts(s); setRequests(r)
    } catch { toast.error('Failed to load data') }
    finally { setLoading(false) }
  }

  useEffect(() => { setLoading(true); fetchData() }, [days])

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
          { label: 'Scheduled', value: stats.scheduled,  color: 'text-emerald-700 bg-emerald-50' },
          { label: 'Completed', value: stats.completed,  color: 'text-slate-600 bg-slate-100' },
          { label: 'Cancelled', value: stats.cancelled,  color: 'text-red-600 bg-red-50' },
          { label: 'Swapped',   value: stats.swapped,    color: 'text-teal-700 bg-teal-50' },
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
        <ShiftCalendar shifts={shifts} onShiftClick={s => setDetailShift(s)} />
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

      {/* Step 1 — Shift detail modal (calendar click) */}
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

      {/* Step 2 — Request form (from detail modal or shift card) */}
      {requestForm && (
        <RequestForm shift={requestForm.shift} requestType={requestForm.requestType}
          onClose={() => setRequestForm(null)} onSubmitted={fetchData} />
      )}
    </div>
  )
}
