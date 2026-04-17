'use client'
import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns'

const SHIFT_BG    = { Morning: 'bg-amber-100 text-amber-800', Afternoon: 'bg-sky-100 text-sky-800', Evening: 'bg-purple-100 text-purple-800', Night: 'bg-indigo-100 text-indigo-800' }
const STATUS_MUTE = { Cancelled: 'opacity-40 line-through', Swapped: 'opacity-60 italic' }

export default function ShiftCalendar({ shifts, onShiftClick }) {
  const [viewDate, setViewDate] = useState(new Date())
  const days = eachDayOfInterval({ start: startOfMonth(viewDate), end: endOfMonth(viewDate) })
  const padding = startOfMonth(viewDate).getDay()

  const prev = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const next = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prev} className="btn-secondary py-1 px-3 text-sm">‹</button>
        <h2 className="font-bold text-slate-700 text-lg">{format(viewDate, 'MMMM yyyy')}</h2>
        <button onClick={next} className="btn-secondary py-1 px-3 text-sm">›</button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-slate-400 pb-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: padding }).map((_, i) => <div key={`p${i}`} />)}
        {days.map(day => {
          const dayShifts = shifts.filter(s => isSameDay(new Date(s.startTime), day))
          const today = isToday(day)
          return (
            <div key={day.toISOString()} className={`min-h-[72px] rounded-lg p-1.5 border transition-colors ${today ? 'border-blue-400 bg-blue-50' : 'border-slate-100 hover:border-slate-300 bg-white'}`}>
              <p className={`text-xs font-semibold mb-1 ${today ? 'text-blue-700' : 'text-slate-500'}`}>{format(day, 'd')}</p>
              {dayShifts.slice(0, 2).map(s => (
                <button key={s.id} onClick={() => onShiftClick?.(s)}
                  className={`text-xs rounded px-1 py-0.5 truncate text-left w-full mb-0.5 ${SHIFT_BG[s.shiftType] || 'bg-slate-100 text-slate-700'} ${STATUS_MUTE[s.status] || ''}`}>
                  {s.shiftType[0]} {format(new Date(s.startTime), 'HH:mm')}
                </button>
              ))}
              {dayShifts.length > 2 && <span className="text-xs text-slate-400">+{dayShifts.length - 2}</span>}
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 mt-4 pt-3 border-t border-slate-100 flex-wrap">
        {Object.entries(SHIFT_BG).map(([type, cls]) => (
          <span key={type} className={`text-xs px-2 py-0.5 rounded font-medium ${cls}`}>{type}</span>
        ))}
      </div>
    </div>
  )
}
