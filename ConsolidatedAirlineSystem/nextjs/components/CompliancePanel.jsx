'use client'
import { useState } from 'react'

// ── Constants ─────────────────────────────────────────────────────────────────

const RULE_LABELS = {
  REST_PERIOD:      'Insufficient Rest',
  CONSECUTIVE_DAYS: 'Consecutive Days',
  MAX_DAILY_HOURS:  'Daily Hours Exceeded',
  MAX_WEEKLY_HOURS: 'Weekly Hours Exceeded',
  OVERTIME_DAILY:   'Daily Overtime',
  OVERTIME_WEEKLY:  'Weekly Overtime',
  FATIGUE_ROLLING:  'Fatigue Threshold',
}

const RULE_ICONS = {
  REST_PERIOD:      '😴',
  CONSECUTIVE_DAYS: '📅',
  MAX_DAILY_HOURS:  '⏱️',
  MAX_WEEKLY_HOURS: '📊',
  OVERTIME_DAILY:   '💰',
  OVERTIME_WEEKLY:  '💰',
  FATIGUE_ROLLING:  '⚠️',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }) {
  return severity === 'critical'
    ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">🔴 Critical</span>
    : <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">🟡 Warning</span>
}

function FatigueBar({ hours, max, label }) {
  const pct = Math.min(100, (hours / max) * 100)
  const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className={pct >= 100 ? 'text-red-600 font-semibold' : 'text-slate-600'}>{hours.toFixed(1)} h / {max} h</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ViolationRow({ v }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg text-sm ${v.severity === 'critical' ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100'}`}>
      <span className="text-lg mt-0.5 shrink-0">{RULE_ICONS[v.type] ?? '⚠️'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-semibold text-slate-700">{RULE_LABELS[v.type] ?? v.type}</span>
          <SeverityBadge severity={v.severity} />
          <span className="text-xs text-slate-400">{v.date}</span>
        </div>
        <p className="text-slate-600 text-xs leading-relaxed">{v.message}</p>
      </div>
    </div>
  )
}

function UserComplianceCard({ row, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const hasCritical = row.criticalCount > 0
  const hasViolations = row.violations.length > 0

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${hasCritical ? 'border-red-200' : hasViolations ? 'border-amber-200' : 'border-slate-100'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${hasCritical ? 'bg-red-500' : hasViolations ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          <div className="text-left min-w-0">
            <p className="font-semibold text-slate-800 text-sm truncate">{row.user.name}</p>
            <p className="text-xs text-slate-500">{row.user.employeeId} · {row.user.department} · {row.scheduledShifts} upcoming shifts</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {row.criticalCount > 0 && (
            <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              {row.criticalCount} critical
            </span>
          )}
          {row.warningCount > 0 && (
            <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {row.warningCount} warning{row.warningCount > 1 ? 's' : ''}
            </span>
          )}
          {!hasViolations && (
            <span className="text-xs font-semibold text-emerald-600">✓ Compliant</span>
          )}
          <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-2">
          {/* Fatigue hours summary */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              { label: '7-day hours',  val: row.violations.length === 0 ? row.totalHours : null, computed: true },
            ].filter(() => false) /* placeholder, computed per-user requires separate fetch */}
            <div className="col-span-3 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 flex items-center gap-4">
              <span>Hours scheduled (total): <strong className="text-slate-700">{row.totalHours.toFixed(1)} h</strong></span>
              <span>Upcoming shifts: <strong className="text-slate-700">{row.scheduledShifts}</strong></span>
            </div>
          </div>
          {hasViolations
            ? <div className="space-y-2">{row.violations.map((v, i) => <ViolationRow key={i} v={v} />)}</div>
            : <p className="text-sm text-emerald-600 text-center py-2">No violations detected for this employee.</p>
          }
        </div>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function CompliancePanel({ data, loading, onRefresh }) {
  const [filterSeverity, setFilterSeverity] = useState('All')
  const [filterDept,     setFilterDept]     = useState('All')
  const [showCompliant,  setShowCompliant]  = useState(false)
  const [expandAll,      setExpandAll]      = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-4xl mb-3">⚖️</div>
          <p className="text-slate-500">Running compliance checks…</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { summary, users } = data

  // Departments for filter dropdown
  const departments = ['All', ...new Set(users.map(r => r.user.department).filter(Boolean))]

  // Apply filters
  const filtered = users.filter(row => {
    if (!showCompliant && row.violations.length === 0) return false
    if (filterSeverity === 'critical' && row.criticalCount === 0) return false
    if (filterSeverity === 'warning'  && row.warningCount  === 0 && row.criticalCount === 0) return false
    if (filterDept !== 'All' && row.user.department !== filterDept) return false
    return true
  })

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Staff Checked',
            value: summary.usersChecked,
            icon:  '👥',
            color: 'text-slate-700',
            bg:    'bg-slate-50',
          },
          {
            label: 'With Violations',
            value: summary.usersWithViolations,
            icon:  '🚨',
            color: summary.usersWithViolations > 0 ? 'text-red-600' : 'text-emerald-600',
            bg:    summary.usersWithViolations > 0 ? 'bg-red-50' : 'bg-emerald-50',
          },
          {
            label: 'Critical Flags',
            value: summary.totalCritical,
            icon:  '🔴',
            color: summary.totalCritical > 0 ? 'text-red-700' : 'text-emerald-600',
            bg:    summary.totalCritical > 0 ? 'bg-red-50' : 'bg-emerald-50',
          },
          {
            label: 'Warnings',
            value: summary.totalWarning,
            icon:  '🟡',
            color: summary.totalWarning > 0 ? 'text-amber-700' : 'text-emerald-600',
            bg:    summary.totalWarning > 0 ? 'bg-amber-50' : 'bg-emerald-50',
          },
        ].map(s => (
          <div key={s.label} className={`card py-4 px-4 ${s.bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{s.icon}</span>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Rules reference */}
      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700 select-none">
          📋 Collective Agreement Rules (click to expand)
        </summary>
        <div className="mt-3 grid sm:grid-cols-2 gap-2 text-xs">
          {[
            { rule: 'Minimum Rest Between Shifts', threshold: '≥ 11 h', severity: 'critical' },
            { rule: 'Maximum Consecutive Working Days', threshold: '≤ 6 days', severity: 'critical' },
            { rule: 'Maximum Daily Hours', threshold: '≤ 12 h/day', severity: 'critical' },
            { rule: 'Maximum Weekly Hours (EU WTD)', threshold: '≤ 48 h / 7 days', severity: 'critical' },
            { rule: 'Daily Overtime Threshold', threshold: '> 8 h triggers pay', severity: 'warning' },
            { rule: 'Weekly Overtime Threshold', threshold: '> 40 h / 7 days', severity: 'warning' },
            { rule: 'Fatigue Rolling Window', threshold: '≤ 60 h / 14 days', severity: 'warning' },
          ].map(r => (
            <div key={r.rule} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50">
              <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${r.severity === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`} />
              <div>
                <p className="font-medium text-slate-700">{r.rule}</p>
                <p className="text-slate-500">{r.threshold}</p>
              </div>
            </div>
          ))}
        </div>
      </details>

      {/* Filters + toolbar */}
      <div className="card flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[160px]">
          <label className="text-xs font-medium text-slate-500 shrink-0">Severity</label>
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="input-field text-sm">
            <option value="All">All</option>
            <option value="critical">Critical only</option>
            <option value="warning">Warnings only</option>
          </select>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[160px]">
          <label className="text-xs font-medium text-slate-500 shrink-0">Department</label>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="input-field text-sm">
            {departments.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none shrink-0">
          <input type="checkbox" checked={showCompliant} onChange={e => setShowCompliant(e.target.checked)} className="rounded" />
          Show compliant staff
        </label>
        <div className="flex gap-2 ml-auto shrink-0">
          <button onClick={() => setExpandAll(v => !v)} className="btn-secondary text-xs py-1.5 px-3">
            {expandAll ? 'Collapse all' : 'Expand all'}
          </button>
          <button onClick={onRefresh} className="btn-secondary text-xs py-1.5 px-3">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Per-user rows */}
      {filtered.length === 0 ? (
        <div className="card text-center py-10 text-slate-400">
          <p className="text-3xl mb-2">✅</p>
          <p className="font-semibold text-slate-600">No violations match current filters</p>
          <p className="text-sm mt-1">
            {summary.usersWithViolations === 0
              ? 'All staff are fully compliant with the collective agreement.'
              : 'Try adjusting the filters above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">{filtered.length} employee{filtered.length !== 1 ? 's' : ''} shown</p>
          {filtered.map(row => (
            <UserComplianceCard
              key={row.user.id}
              row={row}
              defaultOpen={expandAll}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">
        Last checked: {new Date(summary.checkedAt).toLocaleString()}
      </p>
    </div>
  )
}
