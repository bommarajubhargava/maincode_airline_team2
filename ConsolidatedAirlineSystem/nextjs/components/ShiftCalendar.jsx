'use client'
import { useState, useEffect, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns'

const SHIFT_BG    = { Morning: 'bg-amber-100 text-amber-800', Afternoon: 'bg-sky-100 text-sky-800', Evening: 'bg-purple-100 text-purple-800', Night: 'bg-indigo-100 text-indigo-800' }
const STATUS_MUTE = { Cancelled: 'opacity-40 line-through', Swapped: 'opacity-60 italic' }

export default function ShiftCalendar({ shifts = [], days: durationDays = 30, onShiftClick, onDayClick }) {
  const [viewDate, setViewDate]   = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)

  // Reset to today's month whenever the duration changes
  useEffect(() => {
    setViewDate(new Date())
    setSelectedDay(null)
  }, [durationDays])

  // Auto-navigate to first month with shifts if current month is empty
  useEffect(() => {
    if (!shifts?.length) return
    const now = new Date()
    const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`
    const hasShiftThisMonth = shifts.some(s => {
      const d = new Date(s.startTime)
      return `${d.getFullYear()}-${d.getMonth()}` === currentMonthKey
    })
    if (!hasShiftThisMonth) {
      const earliest = shifts.reduce((min, s) => {
        const d = new Date(s.startTime)
        return d < min ? d : min
      }, new Date(shifts[0].startTime))
      setViewDate(new Date(earliest.getFullYear(), earliest.getMonth(), 1))
    }
  }, [shifts])

  // Build month buckets for the strip
  const monthBuckets = useMemo(() => {
    const map = {}
    for (const s of shifts) {
      const d = new Date(s.startTime)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!map[key]) map[key] = { year: d.getFullYear(), month: d.getMonth(), label: format(d, 'MMM yyyy'), count: 0 }
      map[key].count++
    }
    return Object.values(map).sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
  }, [shifts])

  const calDays  = eachDayOfInterval({ start: startOfMonth(viewDate), end: endOfMonth(viewDate) })
  const padding  = startOfMonth(viewDate).getDay()
  const viewKey  = `${viewDate.getFullYear()}-${viewDate.getMonth()}`

  const prev = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const next = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  const handleDayClick = (day) => {
    setSelectedDay(day)
    onDayClick?.(day)
  }

  return (
    <div className="card space-y-4">
      {/* Month strip */}
      {monthBuckets.length > 1 && (
        <div className="flex gap-2 flex-wrap pb-3 border-b border-slate-100">
          <span className="text-xs text-slate-400 self-center shrink-0">Jump to:</span>
          {monthBuckets.map(m => {
            const isActive = `${m.year}-${m.month}` === viewKey
            return (
              <button
                key={`${m.year}-${m.month}`}
                onClick={() => setViewDate(new Date(m.year, m.month, 1))}
                className={`text-xs px-3 py-1 rounded-full font-medium border transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {m.label}
                <span className={`ml-1.5 text-xs font-bold ${isActive ? 'text-blue-200' : 'text-slate-400'}`}>
                  {m.count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prev} className="btn-secondary py-1 px-3 text-sm">‹</button>
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-slate-700 text-lg">{format(viewDate, 'MMMM yyyy')}</h2>
          <button
            onClick={() => { setViewDate(new Date()); setSelectedDay(null) }}
            className="text-xs text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 hover:bg-blue-50"
          >
            Today
          </button>
        </div>
        <button onClick={next} className="btn-secondary py-1 px-3 text-sm">›</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-slate-400 pb-2">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: padding }).map((_, i) => <div key={`p${i}`} />)}
        {calDays.map(day => {
          const dayShifts = shifts.filter(s => isSameDay(new Date(s.startTime), day))
          const todayFlag  = isToday(day)
          const isSelected = selectedDay && isSameDay(day, selectedDay)
          return (
            <div
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              className={`min-h-[72px] rounded-lg p-1.5 border cursor-pointer transition-colors
                ${isSelected  ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-300'
                : todayFlag   ? 'border-blue-400 bg-blue-50'
                :               'border-slate-100 hover:border-slate-300 bg-white'}`}
            >
              <p className={`text-xs font-semibold mb-1 ${todayFlag ? 'text-blue-700' : 'text-slate-500'}`}>{format(day, 'd')}</p>
              {dayShifts.slice(0, 2).map(s => (
                <div key={s.id}
                  className={`text-xs rounded px-1 py-0.5 truncate w-full mb-0.5 ${SHIFT_BG[s.shiftType] || 'bg-slate-100 text-slate-700'} ${STATUS_MUTE[s.status] || ''}`}
                  onClick={e => { e.stopPropagation(); onShiftClick?.(s) }}
                >
                  {s.shiftType[0]} {format(new Date(s.startTime), 'HH:mm')}
                </div>
              ))}
              {dayShifts.length > 2 && <span className="text-xs text-slate-400">+{dayShifts.length - 2}</span>}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3 pt-3 border-t border-slate-100 flex-wrap">
        {Object.entries(SHIFT_BG).map(([type, cls]) => (
          <span key={type} className={`text-xs px-2 py-0.5 rounded font-medium ${cls}`}>{type}</span>
        ))}
      </div>
    </div>
  )
}
