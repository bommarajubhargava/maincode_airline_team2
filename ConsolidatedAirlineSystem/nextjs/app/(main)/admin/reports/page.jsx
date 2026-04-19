'use client'
import { useState, useCallback } from 'react'
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import toast from 'react-hot-toast'

const HOME_AIRPORTS = [
  { id: 'ALL', name: 'All Airports' },
  { id: 'YYZ', name: 'Toronto Pearson International' },
  { id: 'YTZ', name: 'Billy Bishop Toronto City' },
  { id: 'YHM', name: 'John C. Munro Hamilton' },
]

const REPORT_TYPES = [
  { key: 'flight_completion',  label: 'Flight Completion',   icon: '✈️',  desc: 'Daily flight & duty completion rates per airport' },
  { key: 'attendance',         label: 'Employee Attendance',  icon: '👥',  desc: 'Shift attendance rates per employee' },
  { key: 'duty_performance',   label: 'Duty Performance',     icon: '🎯',  desc: 'Completion rates by duty type (General, Catering, Cleanup)' },
  { key: 'staff_utilization',  label: 'Staff Utilization',    icon: '⏱️',  desc: 'Total hours and shifts per employee' },
]

const PERIOD_PRESETS = [
  { label: 'Last 7 days',  key: 'week' },
  { label: 'Last 30 days', key: 'month' },
  { label: 'This month',   key: 'this_month' },
  { label: 'Last month',   key: 'last_month' },
  { label: 'Custom',       key: 'custom' },
]

function getPresetDates(key) {
  const today = new Date()
  switch (key) {
    case 'week':       return { start: format(subDays(today, 6), 'yyyy-MM-dd'),        end: format(today, 'yyyy-MM-dd') }
    case 'month':      return { start: format(subDays(today, 29), 'yyyy-MM-dd'),       end: format(today, 'yyyy-MM-dd') }
    case 'this_month': return { start: format(startOfMonth(today), 'yyyy-MM-dd'),      end: format(endOfMonth(today), 'yyyy-MM-dd') }
    case 'last_month': {
      const lm = subMonths(today, 1)
      return { start: format(startOfMonth(lm), 'yyyy-MM-dd'), end: format(endOfMonth(lm), 'yyyy-MM-dd') }
    }
    default: return { start: format(subDays(today, 6), 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') }
  }
}

function pct(n) { return `${n}%` }
function pctColor(n) {
  if (n >= 80) return 'text-emerald-600'
  if (n >= 50) return 'text-amber-500'
  return 'text-red-500'
}
function barColor(n) {
  if (n >= 80) return 'bg-emerald-500'
  if (n >= 50) return 'bg-amber-400'
  return 'bg-red-400'
}
function Bar({ value }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
        <div className={`h-full rounded-full ${barColor(value)}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-xs font-semibold w-9 text-right ${pctColor(value)}`}>{pct(value)}</span>
    </div>
  )
}

// ── PDF export ────────────────────────────────────────────────────────────────

function buildPrintHTML(reportLabel, airportLabel, startDate, endDate, tableHTML) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${reportLabel} — ${airportLabel}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #64748b; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-size: 11px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
  td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
  tr:last-child td { border-bottom: none; }
  .badge { display:inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .green { background:#dcfce7; color:#166534; }
  .amber { background:#fef9c3; color:#92400e; }
  .red   { background:#fee2e2; color:#991b1b; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<h1>✈️ SkyWave Air — ${reportLabel}</h1>
<div class="sub">${airportLabel} &nbsp;·&nbsp; ${startDate} to ${endDate} &nbsp;·&nbsp; Generated ${new Date().toLocaleString()}</div>
${tableHTML}
</body>
</html>`
}

function pctBadge(n) {
  const cls = n >= 80 ? 'green' : n >= 50 ? 'amber' : 'red'
  return `<span class="badge ${cls}">${n}%</span>`
}

function downloadPDF(reportLabel, airportLabel, startDate, endDate, tableHTML) {
  const win = window.open('', '_blank')
  if (!win) { toast.error('Allow popups to download PDF'); return }
  win.document.write(buildPrintHTML(reportLabel, airportLabel, startDate, endDate, tableHTML))
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 400)
}

// ── Table builders ────────────────────────────────────────────────────────────

function flightCompletionHTML(data) {
  const rows = data.map(r => `
    <tr>
      <td>${r.airport}</td><td>${r.day}</td><td>${r.totalFlights}</td>
      <td>${r.completedFlights}/${r.totalFlights}</td>
      <td>${r.completedDuties}/${r.totalDuties}</td>
      <td>${pctBadge(r.dutyCompletionPct)}</td>
      <td>${pctBadge(r.flightCompletionPct)}</td>
    </tr>`).join('')
  return `<table><thead><tr>
    <th>Airport</th><th>Date</th><th>Flights</th><th>Flights Done</th>
    <th>Duties Done</th><th>Duty %</th><th>Flight %</th>
  </tr></thead><tbody>${rows}</tbody></table>`
}

function attendanceHTML(data) {
  const rows = data.map(r => `
    <tr>
      <td>${r.name}</td><td>${r.employeeId}</td><td>${r.role}</td>
      <td>${r.airportId}</td><td>${r.totalShifts}</td>
      <td>${r.completed}</td><td>${r.scheduled}</td><td>${r.cancelled}</td>
      <td>${r.totalHours} h</td><td>${pctBadge(r.attendancePct)}</td>
    </tr>`).join('')
  return `<table><thead><tr>
    <th>Name</th><th>ID</th><th>Role</th><th>Airport</th>
    <th>Total</th><th>Completed</th><th>Scheduled</th><th>Cancelled</th>
    <th>Hours</th><th>Attendance %</th>
  </tr></thead><tbody>${rows}</tbody></table>`
}

function dutyHTML(data) {
  const rows = data.map(r => `
    <tr>
      <td>${r.airportId}</td><td>${r.duty}</td><td>${r.totalShifts}</td>
      <td>${r.completed}</td><td>${r.scheduled}</td><td>${r.cancelled}</td>
      <td>${pctBadge(r.completionPct)}</td>
    </tr>`).join('')
  return `<table><thead><tr>
    <th>Airport</th><th>Duty Type</th><th>Total Shifts</th>
    <th>Completed</th><th>Scheduled</th><th>Cancelled</th><th>Completion %</th>
  </tr></thead><tbody>${rows}</tbody></table>`
}

function utilizationHTML(data) {
  const rows = data.map(r => `
    <tr>
      <td>${r.name}</td><td>${r.employeeId}</td><td>${r.role}</td>
      <td>${r.airportId}</td><td>${r.totalShifts}</td><td>${r.totalHours} h</td>
      <td>${r.totalShifts > 0 ? Math.round(r.totalHours / r.totalShifts * 10) / 10 : 0} h</td>
      <td>${r.breakdown.map(b => `${b.shiftType}: ${b.shifts} shifts / ${b.hours}h`).join(', ')}</td>
    </tr>`).join('')
  return `<table><thead><tr>
    <th>Name</th><th>ID</th><th>Role</th><th>Airport</th>
    <th>Total Shifts</th><th>Total Hours</th><th>Avg h/shift</th><th>Breakdown</th>
  </tr></thead><tbody>${rows}</tbody></table>`
}

// ── React tables ──────────────────────────────────────────────────────────────

function FlightCompletionTable({ data }) {
  const airports = [...new Set(data.map(r => r.airport))]
  return (
    <div className="space-y-4">
      {airports.map(ap => {
        const apRows = data.filter(r => r.airport === ap)
        const apName = HOME_AIRPORTS.find(a => a.id === ap)?.name ?? ap
        const avgDuty = apRows.length ? Math.round(apRows.reduce((s, r) => s + r.dutyCompletionPct, 0) / apRows.length) : 0
        return (
          <div key={ap} className="card border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div><span className="font-bold text-slate-800">{ap}</span><span className="ml-2 text-sm text-slate-500">{apName}</span></div>
              <span className={`text-sm font-bold ${pctColor(avgDuty)}`}>avg duty {avgDuty}%</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100">
                  {['Date','Flights','Done','Duties','Duty %','Flight %'].map(h => <th key={h} className="pb-2 text-left text-xs font-semibold text-slate-500">{h}</th>)}
                </tr></thead>
                <tbody>
                  {apRows.map(r => (
                    <tr key={r.day} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 font-medium text-slate-700">{r.day}</td>
                      <td className="py-2 text-slate-600">{r.totalFlights}</td>
                      <td className="py-2"><span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${r.completedFlights===r.totalFlights?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{r.completedFlights}/{r.totalFlights}</span></td>
                      <td className="py-2 text-slate-600">{r.completedDuties}/{r.totalDuties}</td>
                      <td className="py-2 min-w-[110px]"><Bar value={r.dutyCompletionPct} /></td>
                      <td className="py-2 min-w-[110px]"><Bar value={r.flightCompletionPct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AttendanceTable({ data }) {
  const airports = [...new Set(data.map(r => r.airportId))]
  return (
    <div className="space-y-4">
      {airports.map(ap => {
        const apRows = data.filter(r => r.airportId === ap)
        const apName = HOME_AIRPORTS.find(a => a.id === ap)?.name ?? ap
        return (
          <div key={ap} className="card border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div><span className="font-bold text-slate-800">{ap}</span><span className="ml-2 text-sm text-slate-500">{apName}</span></div>
              <span className="text-xs text-slate-500">{apRows.length} employees</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100">
                  {['Employee','ID','Role','Total Shifts','Completed','Scheduled','Cancelled','Hours','Attendance %'].map(h =>
                    <th key={h} className="pb-2 text-left text-xs font-semibold text-slate-500">{h}</th>)}
                </tr></thead>
                <tbody>
                  {apRows.map(r => (
                    <tr key={r.employeeId} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 font-medium text-slate-800">{r.name}</td>
                      <td className="py-2 text-slate-500 text-xs">{r.employeeId}</td>
                      <td className="py-2"><span className="text-xs px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">{r.role}</span></td>
                      <td className="py-2 text-slate-600">{r.totalShifts}</td>
                      <td className="py-2 text-emerald-600 font-medium">{r.completed}</td>
                      <td className="py-2 text-blue-600">{r.scheduled}</td>
                      <td className="py-2 text-red-500">{r.cancelled}</td>
                      <td className="py-2 text-slate-600">{r.totalHours} h</td>
                      <td className="py-2 min-w-[110px]"><Bar value={r.attendancePct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DutyPerformanceTable({ data }) {
  const airports = [...new Set(data.map(r => r.airportId))]
  const DUTY_COLORS = { General: 'bg-slate-100 text-slate-700', Catering: 'bg-orange-100 text-orange-700', Cleanup: 'bg-teal-100 text-teal-700' }
  return (
    <div className="space-y-4">
      {airports.map(ap => {
        const apRows = data.filter(r => r.airportId === ap)
        const apName = HOME_AIRPORTS.find(a => a.id === ap)?.name ?? ap
        return (
          <div key={ap} className="card border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div><span className="font-bold text-slate-800">{ap}</span><span className="ml-2 text-sm text-slate-500">{apName}</span></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100">
                  {['Duty Type','Total Shifts','Completed','Scheduled','Cancelled','Completion %'].map(h =>
                    <th key={h} className="pb-2 text-left text-xs font-semibold text-slate-500">{h}</th>)}
                </tr></thead>
                <tbody>
                  {apRows.map(r => (
                    <tr key={r.duty} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${DUTY_COLORS[r.duty] ?? 'bg-slate-100 text-slate-600'}`}>{r.duty}</span></td>
                      <td className="py-2 text-slate-600">{r.totalShifts}</td>
                      <td className="py-2 text-emerald-600 font-medium">{r.completed}</td>
                      <td className="py-2 text-blue-600">{r.scheduled}</td>
                      <td className="py-2 text-red-500">{r.cancelled}</td>
                      <td className="py-2 min-w-[110px]"><Bar value={r.completionPct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function UtilizationTable({ data }) {
  const SHIFT_COLORS = { Morning: 'bg-amber-100 text-amber-700', Afternoon: 'bg-blue-100 text-blue-700', Night: 'bg-indigo-100 text-indigo-700' }
  const airports = [...new Set(data.map(r => r.airportId))]
  return (
    <div className="space-y-4">
      {airports.map(ap => {
        const apRows = data.filter(r => r.airportId === ap)
        const apName = HOME_AIRPORTS.find(a => a.id === ap)?.name ?? ap
        const totalHours = apRows.reduce((s, r) => s + r.totalHours, 0)
        return (
          <div key={ap} className="card border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div><span className="font-bold text-slate-800">{ap}</span><span className="ml-2 text-sm text-slate-500">{apName}</span></div>
              <span className="text-xs text-slate-500">Total: {Math.round(totalHours * 10) / 10} h across {apRows.length} employees</span>
            </div>
            <div className="space-y-3">
              {apRows.map(r => (
                <div key={r.employeeId} className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{r.name}</p>
                      <p className="text-xs text-slate-500">{r.employeeId} · {r.role}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-700">{r.totalHours} h total</p>
                      <p className="text-xs text-slate-500">{r.totalShifts} shifts · avg {r.totalShifts > 0 ? Math.round(r.totalHours / r.totalShifts * 10) / 10 : 0} h/shift</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {r.breakdown.map(b => (
                      <span key={b.shiftType} className={`text-xs px-2 py-0.5 rounded-full font-medium ${SHIFT_COLORS[b.shiftType] ?? 'bg-slate-200 text-slate-600'}`}>
                        {b.shiftType}: {b.shifts} shifts / {b.hours} h
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminReportsPage() {
  const [reportType, setReportType] = useState('flight_completion')
  const [airport, setAirport]       = useState('ALL')
  const [preset, setPreset]         = useState('week')
  const [startDate, setStartDate]   = useState(() => getPresetDates('week').start)
  const [endDate, setEndDate]       = useState(() => getPresetDates('week').end)
  const [data, setData]             = useState([])
  const [loading, setLoading]       = useState(false)
  const [generated, setGenerated]   = useState(false)

  const applyPreset = (key) => {
    setPreset(key)
    if (key !== 'custom') {
      const { start, end } = getPresetDates(key)
      setStartDate(start); setEndDate(end)
    }
  }

  const generate = useCallback(async () => {
    setLoading(true); setGenerated(true)
    try {
      const params = new URLSearchParams({ type: reportType, startDate, endDate })
      if (airport !== 'ALL') params.set('airport', airport)
      const res  = await fetch(`/api/admin/reports?${params}`)
      const json = await res.json()
      setData(Array.isArray(json) ? json : [])
    } catch { toast.error('Failed to generate report') }
    finally { setLoading(false) }
  }, [reportType, airport, startDate, endDate])

  const handleDownloadPDF = () => {
    if (!data.length) { toast.error('Generate a report first'); return }
    const rType   = REPORT_TYPES.find(r => r.key === reportType)
    const apLabel = airport === 'ALL' ? 'All Airports' : HOME_AIRPORTS.find(a => a.id === airport)?.name ?? airport
    let tableHTML = ''
    if (reportType === 'flight_completion')  tableHTML = flightCompletionHTML(data)
    else if (reportType === 'attendance')    tableHTML = attendanceHTML(data)
    else if (reportType === 'duty_performance') tableHTML = dutyHTML(data)
    else if (reportType === 'staff_utilization') tableHTML = utilizationHTML(data)
    downloadPDF(rType?.label ?? reportType, apLabel, startDate, endDate, tableHTML)
  }

  const currentType = REPORT_TYPES.find(r => r.key === reportType)

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
        <p className="text-slate-500 text-sm">Operational analytics across airports</p>
      </div>

      {/* Report type selector */}
      <div className="grid sm:grid-cols-4 gap-3 mb-5">
        {REPORT_TYPES.map(rt => (
          <button key={rt.key} onClick={() => { setReportType(rt.key); setGenerated(false); setData([]) }}
            className={`card text-left border-2 transition-colors ${reportType === rt.key ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:border-slate-300'}`}>
            <div className="text-2xl mb-1">{rt.icon}</div>
            <p className={`text-sm font-semibold ${reportType === rt.key ? 'text-blue-700' : 'text-slate-800'}`}>{rt.label}</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{rt.desc}</p>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="card mb-5">
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Airport</label>
            <select value={airport} onChange={e => setAirport(e.target.value)} className="input-field">
              {HOME_AIRPORTS.map(a => <option key={a.id} value={a.id}>{a.id === 'ALL' ? 'All Airports' : `${a.id} — ${a.name}`}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Period</label>
            <div className="flex flex-wrap gap-1.5">
              {PERIOD_PRESETS.map(p => (
                <button key={p.key} onClick={() => applyPreset(p.key)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${preset === p.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={generate} className="btn-primary text-sm">Generate</button>
            <button onClick={handleDownloadPDF} disabled={!data.length}
              className="text-sm px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors">
              ⬇ PDF
            </button>
          </div>
        </div>

        {preset === 'custom' && (
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <div><label className="text-xs font-medium text-slate-600 block mb-1">From Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field" /></div>
            <div><label className="text-xs font-medium text-slate-600 block mb-1">To Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field" /></div>
          </div>
        )}
        <p className="text-xs text-slate-400 mt-2">{startDate} → {endDate} &nbsp;·&nbsp; {currentType?.label}</p>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><p className="text-slate-500">Generating report…</p></div>
      ) : !generated ? (
        <div className="card text-center py-12 text-slate-400">
          <div className="text-4xl mb-2">{currentType?.icon}</div>
          <p className="font-medium text-slate-600">{currentType?.label}</p>
          <p className="text-sm mt-1">{currentType?.desc}</p>
          <p className="text-xs mt-3">Select a period and click Generate</p>
        </div>
      ) : data.length === 0 ? (
        <div className="card text-center py-10 text-slate-500">No data found for this period</div>
      ) : (
        <>
          {reportType === 'flight_completion'  && <FlightCompletionTable data={data} />}
          {reportType === 'attendance'          && <AttendanceTable data={data} />}
          {reportType === 'duty_performance'    && <DutyPerformanceTable data={data} />}
          {reportType === 'staff_utilization'   && <UtilizationTable data={data} />}
        </>
      )}
    </div>
  )
}
