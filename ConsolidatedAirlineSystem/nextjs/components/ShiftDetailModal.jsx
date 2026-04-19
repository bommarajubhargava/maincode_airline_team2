'use client'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'

const TYPE_GRADIENT = {
  Morning:   'from-amber-400 to-orange-400',
  Afternoon: 'from-sky-400 to-blue-500',
  Night:     'from-indigo-500 to-violet-600',
}
const TYPE_LIGHT = {
  Morning:   'bg-amber-50  border-amber-100',
  Afternoon: 'bg-sky-50    border-sky-100',
  Night:     'bg-indigo-50 border-indigo-100',
}
const TYPE_TEXT = {
  Morning:   'text-amber-700',
  Afternoon: 'text-sky-700',
  Night:     'text-indigo-700',
}
const TYPE_ICON = { Morning: '🌅', Afternoon: '☀️', Night: '🌙' }

const STATUS_STYLE = {
  Scheduled: 'bg-emerald-100 text-emerald-700',
  Completed: 'bg-slate-100   text-slate-600',
  Cancelled: 'bg-red-100     text-red-600',
  Swapped:   'bg-teal-100    text-teal-700',
}

const SHIFT_BADGE = {
  Morning:   'bg-amber-100 text-amber-700',
  Afternoon: 'bg-sky-100   text-sky-700',
  Night:     'bg-indigo-100 text-indigo-700',
}

export default function ShiftDetailModal({ shift, onClose, onAction }) {
  const canAct = shift.status === 'Scheduled'
  const [colleagues, setColleagues] = useState([])
  const [loadingColleagues, setLoadingColleagues] = useState(true)

  useEffect(() => {
    const dateStr = format(new Date(shift.startTime), 'yyyy-MM-dd')
    fetch(`/api/shifts/day?date=${dateStr}`)
      .then(r => r.json())
      .then(all => setColleagues(all.filter(s => s.userId !== shift.userId)))
      .catch(() => {})
      .finally(() => setLoadingColleagues(false))
  }, [shift.id, shift.startTime])

  const gradient = TYPE_GRADIENT[shift.shiftType] || 'from-slate-400 to-slate-500'
  const light    = TYPE_LIGHT[shift.shiftType]    || 'bg-slate-50 border-slate-100'
  const textCol  = TYPE_TEXT[shift.shiftType]     || 'text-slate-700'

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">

        {/* Coloured header */}
        <div className={`bg-gradient-to-r ${gradient} px-6 py-5 text-white shrink-0`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{TYPE_ICON[shift.shiftType] || '🕐'}</span>
                <span className="text-xl font-bold">{shift.shiftType} Shift</span>
              </div>
              <p className="text-white/80 text-sm">{format(new Date(shift.startTime), 'EEEE, MMMM d, yyyy')}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full bg-white/20 text-white`}>
                {shift.status}
              </span>
              <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none ml-1">✕</button>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Key details grid */}
          <div className={`rounded-xl border p-4 ${light} grid grid-cols-2 gap-3`}>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${textCol}`}>Time</p>
              <p className="font-bold text-slate-800 text-sm">
                {format(new Date(shift.startTime), 'HH:mm')} – {format(new Date(shift.endTime), 'HH:mm')}
              </p>
            </div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${textCol}`}>Location</p>
              <p className="font-bold text-slate-800 text-sm truncate">{shift.location || '—'}</p>
            </div>
            {shift.duty && (
              <div className="col-span-2">
                <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${textCol}`}>Duty</p>
                <p className="font-bold text-slate-800 text-sm">{shift.duty}</p>
              </div>
            )}
            <div className="col-span-2">
              <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${textCol}`}>Shift ID</p>
              <p className="text-slate-400 text-xs font-mono break-all">{shift.id}</p>
            </div>
          </div>

          {/* Colleagues */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Colleagues on this day
              {!loadingColleagues && <span className="ml-1.5 text-slate-400 font-normal normal-case">({colleagues.length})</span>}
            </p>
            {loadingColleagues ? (
              <p className="text-xs text-slate-400 text-center py-3">Loading…</p>
            ) : colleagues.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-3">No other colleagues scheduled this day</p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {colleagues.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{c.userName}</p>
                      <p className="text-xs text-slate-400">{c.employeeId} · {c.role}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SHIFT_BADGE[c.shiftType] || 'bg-slate-100 text-slate-600'}`}>
                        {c.shiftType}
                      </span>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {format(new Date(c.startTime), 'HH:mm')}–{format(new Date(c.endTime), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          {canAct ? (
            <div className="pt-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Request an action</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { type: 'Cancellation', icon: '🚫', label: 'Cancel',  colors: 'border-red-200    bg-red-50    hover:bg-red-100    text-red-700' },
                  { type: 'Change',       icon: '✏️',  label: 'Change',  colors: 'border-blue-200   bg-blue-50   hover:bg-blue-100   text-blue-700' },
                  { type: 'Swap',         icon: '🔄',  label: 'Swap',    colors: 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700' },
                ].map(a => (
                  <button key={a.type} onClick={() => onAction(shift, a.type)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors ${a.colors}`}>
                    <span className="text-xl">{a.icon}</span>
                    <span className="text-xs font-semibold">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center pt-1 pb-2">
              No actions available for {shift.status.toLowerCase()} shifts
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
