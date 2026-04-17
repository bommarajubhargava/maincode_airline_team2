'use client'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'

const STATUS_BADGE = {
  Scheduled: 'badge-scheduled',
  Completed: 'badge-completed',
  Cancelled: 'badge-cancelled',
  Swapped:   'badge-swapped',
}

const TYPE_BG = {
  Morning:   'bg-amber-50  border-amber-200',
  Afternoon: 'bg-sky-50    border-sky-200',
  Night:     'bg-indigo-50 border-indigo-200',
}

const TYPE_ICON = { Morning: '🌅', Afternoon: '☀️', Night: '🌙' }

export default function ShiftDetailModal({ shift, onClose, onAction }) {
  const canAct = shift.status === 'Scheduled'
  const [colleagues, setColleagues] = useState([])

  useEffect(() => {
    const dateStr = format(new Date(shift.startTime), 'yyyy-MM-dd')
    fetch(`/api/shifts/day?date=${dateStr}`)
      .then(r => r.json())
      .then(all => setColleagues(all.filter(s => s.id !== shift.id)))
      .catch(() => {})
  }, [shift.id, shift.startTime])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">Shift Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">

          {/* Shift type banner */}
          <div className={`rounded-xl border p-4 ${TYPE_BG[shift.shiftType] || 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{TYPE_ICON[shift.shiftType] || '🕐'}</span>
              <span className="font-bold text-slate-800 text-lg">{shift.shiftType} Shift</span>
            </div>
            <span className={STATUS_BADGE[shift.status]}>{shift.status}</span>
          </div>

          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-slate-400 text-lg">📅</span>
              <div>
                <p className="text-xs text-slate-400 font-medium">Date</p>
                <p className="text-slate-700 font-semibold">
                  {format(new Date(shift.startTime), 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-slate-400 text-lg">🕐</span>
              <div>
                <p className="text-xs text-slate-400 font-medium">Time</p>
                <p className="text-slate-700 font-semibold">
                  {format(new Date(shift.startTime), 'HH:mm')} – {format(new Date(shift.endTime), 'HH:mm')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-slate-400 text-lg">📍</span>
              <div>
                <p className="text-xs text-slate-400 font-medium">Location</p>
                <p className="text-slate-700 font-semibold">{shift.location}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-slate-400 text-lg">🪪</span>
              <div>
                <p className="text-xs text-slate-400 font-medium">Shift ID</p>
                <p className="text-slate-500 text-sm font-mono">{shift.id}</p>
              </div>
            </div>
          </div>

          {/* Colleagues on same day */}
          {colleagues.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-400 font-medium mb-2">COLLEAGUES ON THIS DAY</p>
              <div className="space-y-1.5">
                {colleagues.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{c.userName}</p>
                      <p className="text-xs text-slate-400">{c.employeeId} · {c.role}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-600">{c.shiftType}</p>
                      <p className="text-xs text-slate-400">{format(new Date(c.startTime), 'HH:mm')}–{format(new Date(c.endTime), 'HH:mm')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions — only for scheduled shifts */}
          {canAct ? (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-400 font-medium mb-3">REQUEST AN ACTION</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => onAction(shift, 'Cancellation')}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <span className="text-xl">🚫</span>
                  <span className="text-xs font-semibold text-red-700">Cancel</span>
                </button>
                <button
                  onClick={() => onAction(shift, 'Change')}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  <span className="text-xl">✏️</span>
                  <span className="text-xs font-semibold text-blue-700">Change</span>
                </button>
                <button
                  onClick={() => onAction(shift, 'Swap')}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                >
                  <span className="text-xl">🔄</span>
                  <span className="text-xs font-semibold text-indigo-700">Swap</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-400 text-center">
                No actions available for {shift.status.toLowerCase()} shifts
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
