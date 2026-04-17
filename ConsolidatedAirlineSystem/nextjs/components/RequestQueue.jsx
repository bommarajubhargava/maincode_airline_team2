'use client'
import { useState } from 'react'
import { shiftService } from '@/lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const TYPE_COLORS = {
  Cancellation: 'bg-red-100 text-red-700',
  Change:       'bg-blue-100 text-blue-700',
  Swap:         'bg-indigo-100 text-indigo-700',
}
const STATUS_BADGE = {
  Pending:   'badge-pending',
  Approved:  'badge-approved',
  Cancelled: 'badge-cancelled',
  Swapped:   'badge-swapped',
}

export default function RequestQueue({ requests, onRefresh, readOnly = false }) {
  const [commentMap, setCommentMap] = useState({})
  const [loadingId, setLoadingId] = useState(null)
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterType,   setFilterType]   = useState('All')

  const act = async (id, fn, successMsg) => {
    setLoadingId(id)
    try { await fn(); toast.success(successMsg); onRefresh?.() }
    catch (err) { toast.error(err.message) }
    finally { setLoadingId(null) }
  }

  const handleApprove = (id) =>
    act(id, () => shiftService.approveRequest(id, commentMap[id] || ''), 'Request approved')

  const handleReject = (id) =>
    act(id, () => shiftService.rejectRequest(id, commentMap[id] || ''), 'Request cancelled')

  const handleDelete = (id) =>
    act(id, () => shiftService.deleteRequest(id), 'Request deleted')

  const pendingCount = requests.filter(r => r.status === 'Pending').length

  const filtered = requests.filter(r =>
    (filterStatus === 'All' || r.status === filterStatus) &&
    (filterType   === 'All' || r.requestType === filterType)
  )

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {['All','Pending','Approved','Cancelled','Swapped'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${filterStatus === s ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {s}
              {s === 'Pending' && pendingCount > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {['All','Cancellation','Change','Swap'].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${filterType === t ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <p className="text-4xl mb-2">📋</p>
          <p className="font-medium">No requests found</p>
        </div>
      )}

      {filtered.map(req => (
        <div key={req.id} className="card space-y-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-slate-800 text-sm">{req.requestingUserName}</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[req.requestType]}`}>{req.requestType}</span>
                <span className={STATUS_BADGE[req.status] || 'badge-pending'}>{req.status}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{format(new Date(req.createdAt), 'MMM d, yyyy HH:mm')} · {req.id}</p>
            </div>

            {/* Delete button — own requests or manager */}
            <button
              onClick={() => handleDelete(req.id)}
              disabled={loadingId === req.id}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors shrink-0"
              title="Delete request"
            >
              🗑 Delete
            </button>
          </div>

          {req.shift && (
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-0.5">
              <p className="font-semibold text-slate-700">{req.shift.shiftType} · {format(new Date(req.shift.startTime), 'EEE MMM d, HH:mm')}</p>
              <p>{req.shift.location}</p>
              {req.requestType === 'Swap' && req.targetShift && (
                <p className="text-indigo-600 mt-1">⇄ Swap with {req.targetUserName}: {format(new Date(req.targetShift.startTime), 'EEE MMM d, HH:mm')}</p>
              )}
              {req.requestType === 'Change' && req.proposedStartTime && (
                <p className="text-blue-600 mt-1">→ Proposed: {format(new Date(req.proposedStartTime), 'EEE MMM d, HH:mm')}</p>
              )}
            </div>
          )}

          <p className="text-sm text-slate-600"><span className="font-medium">Reason:</span> {req.reason}</p>
          {req.managerComment && <p className="text-sm text-slate-500 italic">Manager note: "{req.managerComment}"</p>}

          {/* Manager approve/reject — only for pending */}
          {!readOnly && req.status === 'Pending' && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <input type="text" placeholder="Optional comment..."
                value={commentMap[req.id] || ''}
                onChange={e => setCommentMap(m => ({ ...m, [req.id]: e.target.value }))}
                className="input-field text-sm" />
              <div className="flex gap-2">
                <button onClick={() => handleApprove(req.id)} disabled={loadingId === req.id} className="btn-success flex-1 text-sm py-1.5">✓ Approve</button>
                <button onClick={() => handleReject(req.id)}  disabled={loadingId === req.id} className="btn-danger flex-1 text-sm py-1.5">✕ Cancel Request</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
