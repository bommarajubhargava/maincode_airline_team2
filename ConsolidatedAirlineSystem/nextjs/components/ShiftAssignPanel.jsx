'use client'
import { useState, useEffect } from 'react'
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday, isBefore, startOfDay } from 'date-fns'
import toast from 'react-hot-toast'

const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa']

function MonthGrid({ baseDate, selected, onToggle, rangeStart, rangeEnd }) {
  const start  = startOfMonth(baseDate)
  const end    = endOfMonth(baseDate)
  const days   = eachDayOfInterval({ start, end })
  const offset = getDay(start)
  const today  = startOfDay(new Date())

  return (
    <div>
      <p className="text-xs font-semibold text-slate-600 mb-2 text-center">
        {format(baseDate, 'MMMM yyyy')}
      </p>
      <div className="grid grid-cols-7 gap-px text-center text-xs">
        {DOW.map(d => <div key={d} className="text-slate-400 font-medium py-1">{d}</div>)}
        {Array(offset).fill(null).map((_, i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const key     = format(day, 'yyyy-MM-dd')
          const isPast  = isBefore(day, today)
          const sel     = selected.includes(key)
          const inRange = rangeStart && rangeEnd && day >= rangeStart && day <= rangeEnd
          return (
            <button key={key} disabled={isPast} onClick={() => onToggle(day, key)}
              className={`py-1.5 rounded text-xs transition-colors
                ${isPast ? 'text-slate-300 cursor-not-allowed' : 'cursor-pointer hover:bg-blue-100'}
                ${sel ? 'bg-blue-600 text-white font-semibold hover:bg-blue-700' : inRange ? 'bg-blue-100 text-blue-700' : 'text-slate-700'}
              `}>
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function ShiftAssignPanel({ employees, lockedAirportId, onAssigned }) {
  const [shiftTypes, setShiftTypes]       = useState([])
  const [airports, setAirports]           = useState([])
  const [selectedEmps, setSelectedEmps]   = useState([])
  const [selectedDates, setSelectedDates] = useState([])
  const [shiftTypeId, setShiftTypeId]     = useState('')
  const [airportId, setAirportId]         = useState(lockedAirportId || 'LHR')
  const [submitting, setSubmitting]       = useState(false)
  const [rangeMode, setRangeMode]       = useState(false)
  const [rangeA, setRangeA]             = useState(null)
  const today    = startOfDay(new Date())
  const months   = [today, addMonths(today, 1), addMonths(today, 2)]

  useEffect(() => {
    Promise.all([
      fetch('/api/shift-types').then(r => r.json()),
      fetch('/api/airports').then(r => r.json()),
    ]).then(([st, ap]) => {
      setShiftTypes(st)
      setAirports(ap)
      if (st[0]) setShiftTypeId(st[0].id)
    })
  }, [])

  // Sync airportId when lockedAirportId becomes available after mount
  useEffect(() => {
    if (lockedAirportId) setAirportId(lockedAirportId)
  }, [lockedAirportId])

  const toggleEmp = (id) =>
    setSelectedEmps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const toggleDate = (day, key) => {
    if (rangeMode) {
      if (!rangeA) { setRangeA(day); return }
      // Expand range
      const [a, b] = rangeA <= day ? [rangeA, day] : [day, rangeA]
      const today2 = startOfDay(new Date())
      const range  = eachDayOfInterval({ start: a, end: b })
        .filter(d => !isBefore(d, today2))
        .map(d => format(d, 'yyyy-MM-dd'))
      setSelectedDates(prev => [...new Set([...prev, ...range])])
      setRangeA(null)
      return
    }
    setSelectedDates(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const clearDates  = () => { setSelectedDates([]); setRangeA(null) }
  const clearAll    = () => { setSelectedDates([]); setSelectedEmps([]); setRangeA(null) }

  const eligibleEmps = employees.filter(e => ['Staff','Agent'].includes(e.role))

  const selectAllStaff = () => setSelectedEmps(eligibleEmps.map(e => e.id))

  const handleDropdownChange = (empId) => {
    if (!empId) return
    setSelectedEmps(prev => prev.includes(empId) ? prev.filter(x => x !== empId) : [...prev, empId])
  }

  const handleAssign = async () => {
    if (!selectedEmps.length)   { toast.error('Select at least one employee'); return }
    if (!selectedDates.length)  { toast.error('Select at least one date'); return }
    if (!shiftTypeId)           { toast.error('Select a shift type'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/manager/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeIds: selectedEmps, shiftTypeId, dates: selectedDates, airportId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      toast.success(`${data.assigned} shifts assigned!`)
      clearAll()
      if (onAssigned) onAssigned()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-6">
      {/* LEFT — Employee selector */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800">Select Employees</h3>
          <button onClick={selectAllStaff} className="text-xs text-blue-600 hover:text-blue-800">Select All</button>
        </div>

        {/* Dropdown */}
        <select
          value=""
          onChange={e => handleDropdownChange(e.target.value)}
          className="input-field mb-3 text-sm"
        >
          <option value="">— Pick an employee —</option>
          {eligibleEmps.map(emp => (
            <option key={emp.id} value={emp.id}>
              {emp.name} ({emp.employeeId} · {emp.role})
            </option>
          ))}
        </select>

        {/* Selected chips */}
        {selectedEmps.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">No employees selected</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {eligibleEmps.filter(e => selectedEmps.includes(e.id)).map(emp => (
              <div key={emp.id} className="flex items-center justify-between p-2 rounded-lg bg-blue-50 border border-blue-200">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{emp.name}</p>
                  <p className="text-xs text-slate-500">{emp.employeeId} · {emp.role}</p>
                </div>
                <button onClick={() => toggleEmp(emp.id)}
                  className="text-slate-400 hover:text-red-500 text-lg leading-none shrink-0 ml-2">×</button>
              </div>
            ))}
          </div>
        )}

        {selectedEmps.length > 0 && (
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-blue-600 font-medium">{selectedEmps.length} selected</p>
            <button onClick={() => setSelectedEmps([])} className="text-xs text-slate-400 hover:text-red-500">Clear all</button>
          </div>
        )}
      </div>

      {/* RIGHT — Calendar + config */}
      <div className="space-y-4">
        {/* Config row */}
        <div className="card">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Shift Type</label>
              <select value={shiftTypeId} onChange={e => setShiftTypeId(e.target.value)} className="input-field">
                {shiftTypes.map(st => <option key={st.id} value={st.id}>{st.name} ({st.start_hour}:00–{st.end_hour}:00)</option>)}
              </select>
            </div>
            {!lockedAirportId && (
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Airport</label>
                <select value={airportId} onChange={e => setAirportId(e.target.value)} className="input-field">
                  {airports.map(ap => <option key={ap.id} value={ap.id}>{ap.id} – {ap.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex flex-col justify-end">
              <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${rangeMode ? 'bg-blue-50 border-blue-300' : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="checkbox" checked={rangeMode} onChange={e => { setRangeMode(e.target.checked); setRangeA(null) }}
                  className="w-3.5 h-3.5 accent-blue-600" />
                <span className="text-sm text-slate-700">Range select</span>
              </label>
            </div>
          </div>
          {rangeMode && (
            <p className="text-xs text-blue-600 mt-2">
              {rangeA ? `Click end date to complete range (started ${format(rangeA,'MMM d')})` : 'Click first date to start range…'}
            </p>
          )}
        </div>

        {/* 3-month calendar */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Select Dates</h3>
            <div className="flex items-center gap-3">
              {selectedDates.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-full">{selectedDates.length} days selected</span>
              )}
              {selectedDates.length > 0 && (
                <button onClick={clearDates} className="text-xs text-slate-500 hover:text-red-500">Clear</button>
              )}
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {months.map((m, i) => (
              <MonthGrid key={i} baseDate={m} selected={selectedDates}
                onToggle={toggleDate} rangeStart={rangeA} rangeEnd={null} />
            ))}
          </div>
        </div>

        {/* Summary + Assign button */}
        <div className="card bg-slate-50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">{selectedEmps.length}</span> employees ×{' '}
                <span className="font-semibold text-slate-800">{selectedDates.length}</span> days ={' '}
                <span className="font-semibold text-blue-700">{selectedEmps.length * selectedDates.length} shifts</span>
              </p>
              {shiftTypeId && shiftTypes.length > 0 && (
                <p className="text-xs text-slate-500">
                  Shift: {shiftTypes.find(s => s.id === shiftTypeId)?.name} · Airport: {airportId}
                </p>
              )}
            </div>
            <button onClick={handleAssign} disabled={submitting || !selectedEmps.length || !selectedDates.length}
              className="btn-primary px-8 disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? 'Assigning…' : 'Assign Shifts'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
