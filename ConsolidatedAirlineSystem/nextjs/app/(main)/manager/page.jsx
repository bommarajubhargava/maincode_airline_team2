'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { shiftService } from '@/lib/api'
import ShiftCard from '@/components/ShiftCard'
import RequestQueue from '@/components/RequestQueue'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const TABS = ['All Shifts', 'Requests', 'Staff List']

export default function ManagerPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('All Shifts')
  const [shifts, setShifts] = useState([])
  const [requests, setRequests] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterName, setFilterName] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [editShift, setEditShift] = useState(null)
  const [editForm, setEditForm] = useState({})

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [s, r, u] = await Promise.all([shiftService.getAllShifts(), shiftService.getAllRequests(), shiftService.getUsers()])
      setShifts(s); setRequests(r); setUsers(u)
    } catch { toast.error('Failed to load data') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

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

  const filteredShifts = shifts.filter(s =>
    (!filterName   || s.userName.toLowerCase().includes(filterName.toLowerCase())) &&
    (!filterDate   || format(new Date(s.startTime), 'yyyy-MM-dd') === filterDate) &&
    (filterType   === 'All' || s.shiftType === filterType) &&
    (filterStatus === 'All' || s.status === filterStatus)
  )

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
          </button>
        ))}
      </div>

      {activeTab === 'All Shifts' && (
        <div>
          <div className="card mb-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><label className="text-xs font-medium text-slate-500 block mb-1">Name</label>
                <input value={filterName} onChange={e => setFilterName(e.target.value)} placeholder="Search name..." className="input-field" /></div>
              <div><label className="text-xs font-medium text-slate-500 block mb-1">Date</label>
                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="input-field" /></div>
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
            {(filterName || filterDate || filterType !== 'All' || filterStatus !== 'All') && (
              <button onClick={() => { setFilterName(''); setFilterDate(''); setFilterType('All'); setFilterStatus('All') }}
                className="text-xs text-blue-600 mt-3">Clear filters</button>
            )}
          </div>
          <p className="text-sm text-slate-500 mb-3">{filteredShifts.length} shifts</p>
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
