'use client'
import { format } from 'date-fns'

const BORDER = { Morning: 'border-l-amber-400 bg-amber-50', Afternoon: 'border-l-sky-400 bg-sky-50', Evening: 'border-l-purple-400 bg-purple-50', Night: 'border-l-indigo-400 bg-indigo-50' }
const BADGE  = { Scheduled: 'badge-scheduled', Completed: 'badge-completed', Cancelled: 'badge-cancelled', Swapped: 'badge-swapped' }

export default function ShiftCard({ shift, onRequestAction, showUser = false }) {
  return (
    <div className={`border-l-4 ${BORDER[shift.shiftType] || 'border-l-slate-300 bg-slate-50'} rounded-lg p-4 shadow-sm border border-slate-100`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {showUser && <p className="text-xs font-semibold text-slate-500 mb-0.5">{shift.userName} · {shift.employeeId}</p>}
          <p className="font-semibold text-slate-800 text-sm">{format(new Date(shift.startTime), 'EEE, MMM d')}</p>
          <p className="text-slate-600 text-sm">{format(new Date(shift.startTime), 'HH:mm')} – {format(new Date(shift.endTime), 'HH:mm')}</p>
          <p className="text-slate-500 text-xs mt-0.5 truncate">{shift.location}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={BADGE[shift.status] || 'badge-scheduled'}>{shift.status}</span>
          <span className="text-xs text-slate-400 font-medium">{shift.shiftType}</span>
        </div>
      </div>

      {onRequestAction && shift.status === 'Scheduled' && (
        <div className="mt-3 pt-3 border-t border-slate-200 flex gap-3">
          {['Cancellation', 'Change', 'Swap'].map((type, i) => (
            <button key={type} onClick={() => onRequestAction(shift, type)}
              className={`text-xs font-medium ${['text-red-600 hover:text-red-800','text-blue-600 hover:text-blue-800','text-indigo-600 hover:text-indigo-800'][i]}`}>
              {['Cancel', 'Change', 'Swap'][i]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
