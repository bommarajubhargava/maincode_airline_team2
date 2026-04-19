'use client'
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

// ── Constants ─────────────────────────────────────────────────────────────────

const CONFLICT_LABELS = {
  COVERAGE_GAP:     'Coverage Gap',
  REST_PERIOD:      'Insufficient Rest',
  CONSECUTIVE_DAYS: 'Consecutive Days',
  MAX_DAILY_HOURS:  'Daily Hours Exceeded',
  MAX_WEEKLY_HOURS: 'Weekly Hours Exceeded',
  OVERTIME_DAILY:   'Daily Overtime',
  OVERTIME_WEEKLY:  'Weekly Overtime',
  FATIGUE_ROLLING:  'Fatigue Threshold',
  MISSING_CERT:     'Missing Certification',
}

const CONFLICT_ICONS = {
  COVERAGE_GAP:     '👥',
  REST_PERIOD:      '😴',
  CONSECUTIVE_DAYS: '📅',
  MAX_DAILY_HOURS:  '⏱️',
  MAX_WEEKLY_HOURS: '📊',
  OVERTIME_DAILY:   '💰',
  OVERTIME_WEEKLY:  '💰',
  FATIGUE_ROLLING:  '⚠️',
  MISSING_CERT:     '🎓',
}

const TMPL_COLORS = {
  Morning:   'bg-blue-100 text-blue-800 border-blue-200',
  Afternoon: 'bg-amber-100 text-amber-800 border-amber-200',
  Night:     'bg-indigo-100 text-indigo-800 border-indigo-200',
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

function isoNextWeek() {
  const d = new Date()
  d.setDate(d.getDate() + 6)
  return d.toISOString().slice(0, 10)
}

function daysBetween(a, b) {
  const days = []
  const start = new Date(a)
  const end   = new Date(b)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d).toISOString().slice(0, 10))
  }
  return days
}

function fmtDay(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConflictRow({ c }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg text-sm ${c.severity === 'critical' ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100'}`}>
      <span className="text-lg mt-0.5 shrink-0">{CONFLICT_ICONS[c.type] ?? '⚠️'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap gap-2 items-center mb-0.5">
          <span className="font-semibold text-slate-700 text-xs">{CONFLICT_LABELS[c.type] ?? c.type}</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${c.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
            {c.severity === 'critical' ? '🔴 Critical' : '🟡 Warning'}
          </span>
          {c.date && <span className="text-xs text-slate-400">{c.date}</span>}
          {c.shiftType && <span className="text-xs text-slate-400">{c.shiftType}</span>}
        </div>
        <p className="text-slate-600 text-xs">{c.message}</p>
        {c.userName && <p className="text-xs text-slate-400 mt-0.5">Employee: {c.userName}</p>}
      </div>
    </div>
  )
}

function RosterGrid({ shifts, days, userMap }) {
  // Group shifts by userId
  const byUser = {}
  for (const s of shifts) {
    if (!byUser[s.userId]) byUser[s.userId] = {}
    const day = new Date(s.startTime).toISOString().slice(0, 10)
    if (!byUser[s.userId][day]) byUser[s.userId][day] = []
    byUser[s.userId][day].push(s)
  }

  const userIds = Object.keys(byUser).sort()

  if (!userIds.length) {
    return (
      <div className="text-center py-10 text-slate-400">
        <p className="text-3xl mb-2">🗓️</p>
        <p className="text-sm">No shifts could be assigned. Check coverage rules and staff availability.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white text-left py-2 px-3 font-semibold text-slate-600 border-b border-slate-100 min-w-[160px]">
              Employee
            </th>
            {days.map(d => (
              <th key={d} className="py-2 px-2 font-semibold text-slate-500 border-b border-slate-100 text-center min-w-[110px] whitespace-nowrap">
                {fmtDay(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {userIds.map(uid => {
            const u = userMap[uid] ?? { name: uid, employeeId: '', department: '' }
            return (
              <tr key={uid} className="hover:bg-slate-50">
                <td className="sticky left-0 bg-white border-b border-slate-50 py-2 px-3">
                  <p className="font-medium text-slate-800 truncate">{u.name}</p>
                  <p className="text-slate-400">{u.employeeId} · {u.department}</p>
                </td>
                {days.map(d => {
                  const dayShifts = byUser[uid]?.[d] ?? []
                  return (
                    <td key={d} className="border-b border-slate-50 py-1.5 px-1 align-top">
                      <div className="space-y-1">
                        {dayShifts.map(s => (
                          <div key={s.id} className={`border rounded px-1.5 py-1 text-xs ${TMPL_COLORS[s.shiftType] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            <p className="font-semibold">{s.shiftType}</p>
                            <p className="opacity-75 truncate">{s.location}</p>
                            <p className="opacity-60">{fmtTime(s.startTime)}–{fmtTime(s.endTime)}</p>
                          </div>
                        ))}
                        {!dayShifts.length && (
                          <span className="text-slate-300">—</span>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ConflictSummaryBar({ summary }) {
  if (!summary) return null
  return (
    <div className="flex flex-wrap gap-3">
      {[
        { label: 'Shifts assigned', value: summary.totalShifts,   color: 'text-blue-700',    bg: 'bg-blue-50'    },
        { label: 'Staff used',      value: summary.usersAssigned,  color: 'text-slate-700',   bg: 'bg-slate-50'   },
        { label: 'Critical',        value: summary.criticalCount,  color: summary.criticalCount > 0 ? 'text-red-700'   : 'text-emerald-700', bg: summary.criticalCount > 0 ? 'bg-red-50'   : 'bg-emerald-50' },
        { label: 'Warnings',        value: summary.warningCount,   color: summary.warningCount  > 0 ? 'text-amber-700' : 'text-emerald-700', bg: summary.warningCount  > 0 ? 'bg-amber-50' : 'bg-emerald-50' },
      ].map(s => (
        <div key={s.label} className={`card py-2 px-4 text-center ${s.bg}`}>
          <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          <p className="text-xs text-slate-500">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Coverage Rules Reference ──────────────────────────────────────────────────

function CoverageRulesRef({ rules, loading }) {
  if (loading) return <p className="text-slate-400 text-sm">Loading rules…</p>
  if (!rules?.length) return null
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {rules.map(r => (
        <div key={r.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{r.icon}</span>
            <span className="font-semibold text-slate-700 text-sm">{r.name}</span>
          </div>
          <p className="text-xs text-slate-500 mb-2">{r.description}</p>
          <div className="flex flex-wrap gap-1">
            <span className="text-xs bg-white border border-slate-200 rounded-full px-2 py-0.5 text-slate-600">
              Min {r.minStaff} staff
            </span>
            {r.shiftTypes.map(t => (
              <span key={t} className="text-xs bg-white border border-slate-200 rounded-full px-2 py-0.5 text-slate-600">{t}</span>
            ))}
            {r.certLabels?.map(c => (
              <span key={c} className="text-xs bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5 text-blue-700">🎓 {c}</span>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">📍 {r.location}</p>
        </div>
      ))}
    </div>
  )
}

// ── Saved Roster Card ─────────────────────────────────────────────────────────

function SavedRosterCard({ roster, onView, onDelete, onPublish }) {
  const isPublished = roster.status === 'Published'
  return (
    <div className={`border rounded-xl p-4 hover:shadow-sm transition-shadow ${isPublished ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-800">{roster.name}</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
              {isPublished ? '✅ Published' : '📋 Draft'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {roster.startDate} → {roster.endDate} · {roster.shiftCount} shifts
          </p>
          <p className="text-xs text-slate-400">{new Date(roster.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => onView(roster)} className="btn-secondary text-xs py-1 px-3">View</button>
          {!isPublished && (
            <>
              <button onClick={() => onPublish(roster)} className="btn-primary text-xs py-1 px-3">Publish</button>
              <button onClick={() => onDelete(roster.id)} className="text-xs text-red-500 hover:text-red-700 px-2">✕</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Publish Modal ─────────────────────────────────────────────────────────────

function PublishModal({ modal, onConfirm, onCancel, publishing }) {
  if (!modal) return null
  const { type, rosterName, message, criticalCount, warningCount } = modal
  const isConflict = type === 'conflict'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 ${isConflict ? 'bg-red-50 border-b border-red-100' : 'bg-blue-50 border-b border-blue-100'}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{isConflict ? '⚠️' : '🚀'}</span>
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                {isConflict ? 'Critical Conflicts Detected' : 'Publish Roster'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">"{rosterName}"</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {!isConflict && (
            <p className="text-sm text-slate-600">
              This will add all shifts from this roster to the <span className="font-semibold text-slate-800">live schedule</span>. Employees will see their shifts in the calendar immediately.
            </p>
          )}

          {isConflict && (
            <>
              <div className="flex gap-3">
                {criticalCount > 0 && (
                  <div className="flex-1 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
                    <p className="text-xs text-red-500 font-medium">Critical</p>
                  </div>
                )}
                {warningCount > 0 && (
                  <div className="flex-1 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-center">
                    <p className="text-2xl font-bold text-amber-600">{warningCount}</p>
                    <p className="text-xs text-amber-500 font-medium">Warnings</p>
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-600">{message}</p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-red-700 mb-1">⚠️ Force publish warning</p>
                <p className="text-xs text-red-600">Publishing despite critical conflicts may result in understaffed shifts, compliance violations, or scheduling errors. Proceed only if you have manually resolved these issues.</p>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary text-sm px-5 py-2">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={publishing}
            className={`text-sm px-5 py-2 rounded-xl font-semibold transition-colors ${
              isConflict
                ? 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
            }`}
          >
            {publishing ? 'Publishing…' : isConflict ? '⚠️ Force Publish' : '🚀 Publish Roster'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SchedulingEngine() {
  const [subTab,         setSubTab]         = useState('generate')
  const [name,           setName]           = useState('')
  const [startDate,      setStartDate]      = useState(isoToday())
  const [endDate,        setEndDate]        = useState(isoNextWeek())
  const [generating,     setGenerating]     = useState(false)
  const [preview,        setPreview]        = useState(null)   // { shifts, conflicts, summary }
  const [saving,         setSaving]         = useState(false)
  const [conflictTab,    setConflictTab]    = useState('roster')
  const [filterSeverity, setFilterSeverity] = useState('All')

  const [rosters,        setRosters]        = useState([])
  const [rostersLoading, setRostersLoading] = useState(false)
  const [viewRoster,     setViewRoster]     = useState(null)   // { roster, shifts, conflicts, summary }
  const [viewLoading,    setViewLoading]    = useState(false)

  const [templates,      setTemplates]      = useState(null)
  const [templatesLoading, setTemplatesLoading] = useState(false)

  const [publishModal,   setPublishModal]   = useState(null)   // { type, rosterName, message, criticalCount, warningCount, roster, force }
  const [publishing,     setPublishing]     = useState(false)

  // Load coverage rules on mount
  useEffect(() => {
    setTemplatesLoading(true)
    fetch('/api/scheduling/templates')
      .then(r => r.json())
      .then(d => setTemplates(d))
      .catch(() => {})
      .finally(() => setTemplatesLoading(false))
  }, [])

  const fetchRosters = useCallback(async () => {
    setRostersLoading(true)
    try {
      const r = await fetch('/api/scheduling/roster')
      setRosters(await r.json())
    } catch { toast.error('Failed to load rosters') }
    finally { setRostersLoading(false) }
  }, [])

  useEffect(() => {
    if (subTab === 'saved') fetchRosters()
  }, [subTab, fetchRosters])

  const handleGenerate = async () => {
    if (!startDate || !endDate) return toast.error('Select a date range')
    setGenerating(true)
    setPreview(null)
    try {
      const res = await fetch('/api/scheduling/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, preview: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setPreview(data)
    } catch (err) { toast.error(err.message) }
    finally { setGenerating(false) }
  }

  const handleSaveDraft = async () => {
    if (!name.trim()) return toast.error('Enter a roster name before saving')
    setSaving(true)
    try {
      const res = await fetch('/api/scheduling/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), startDate, endDate, preview: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      toast.success(`Roster "${data.roster.name}" saved as draft`)
      setPreview(null)
      setName('')
      setSubTab('saved')
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  const handleViewRoster = async (roster) => {
    setViewLoading(true)
    setViewRoster(null)
    try {
      const res  = await fetch(`/api/scheduling/roster/${roster.id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setViewRoster(data)
    } catch (err) { toast.error(err.message) }
    finally { setViewLoading(false) }
  }

  const handleDeleteRoster = async (id) => {
    try {
      const res = await fetch(`/api/scheduling/roster/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).message)
      toast.success('Roster deleted')
      fetchRosters()
      if (viewRoster?.roster?.id === id) setViewRoster(null)
    } catch (err) { toast.error(err.message) }
  }

  const handlePublish = (roster) => {
    const r = roster ?? viewRoster?.roster
    if (!r) return
    setPublishModal({ type: 'confirm', rosterName: r.name, roster: r, force: false })
  }

  const handlePublishConfirm = async () => {
    if (!publishModal) return
    const { roster, force } = publishModal
    const r = roster ?? viewRoster?.roster
    if (!r) return
    setPublishing(true)
    try {
      const res  = await fetch(`/api/scheduling/roster/${r.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 422 && !force) {
          const critical = (data.conflicts ?? []).filter(c => c.severity === 'critical').length
          const warnings = (data.conflicts ?? []).filter(c => c.severity === 'warning').length
          setPublishModal({
            type: 'conflict',
            rosterName: r.name,
            message: data.message,
            criticalCount: critical,
            warningCount: warnings,
            roster: r,
            force: true,
          })
          return
        }
        throw new Error(data.message)
      }
      setPublishModal(null)
      toast.success(`Published ${data.publishedShifts} shifts to live schedule`)
      fetchRosters()
      if (viewRoster) handleViewRoster(data.roster)
    } catch (err) {
      setPublishModal(null)
      toast.error(err.message)
    } finally {
      setPublishing(false)
    }
  }

  // Build user map from templates
  const userMap = Object.fromEntries(
    (templates?.staff ?? []).map(u => [u.id, u])
  )

  // Active data (preview or view)
  const activeData = preview ?? viewRoster
  const days       = activeData ? daysBetween(
    activeData.roster?.startDate ?? startDate,
    activeData.roster?.endDate   ?? endDate
  ) : []

  const filteredConflicts = (activeData?.conflicts ?? []).filter(c =>
    filterSeverity === 'All' || c.severity === filterSeverity
  )

  return (
    <div className="space-y-5">
      <PublishModal
        modal={publishModal}
        onConfirm={handlePublishConfirm}
        onCancel={() => { if (!publishing) setPublishModal(null) }}
        publishing={publishing}
      />

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[{ k: 'generate', l: '⚙️ Generate Roster' }, { k: 'rules', l: '📋 Coverage Rules' }, { k: 'saved', l: '🗂️ Saved Rosters' }].map(t => (
          <button key={t.k} onClick={() => setSubTab(t.k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${subTab === t.k ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── Generate tab ───────────────────────────────────────────────────── */}
      {subTab === 'generate' && (
        <div className="space-y-5">
          {/* Generation form */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-slate-700">Auto-generate Draft Roster</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Roster Name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Week 17 Roster"
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button onClick={handleGenerate} disabled={generating} className="btn-primary">
                {generating ? '⏳ Generating…' : '⚙️ Generate Preview'}
              </button>
              {preview && (
                <button onClick={handleSaveDraft} disabled={saving} className="btn-secondary">
                  {saving ? 'Saving…' : '💾 Save as Draft'}
                </button>
              )}
              {preview && viewRoster === null && preview.summary.criticalCount === 0 && (
                <span className="text-xs text-emerald-600 self-center">✅ No critical issues — safe to publish after saving</span>
              )}
            </div>
          </div>

          {/* Preview results */}
          {preview && (
            <div className="space-y-4">
              <ConflictSummaryBar summary={preview.summary} />

              {/* Roster/Conflict tabs */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit text-sm">
                {['roster', 'conflicts'].map(t => (
                  <button key={t} onClick={() => setConflictTab(t)}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors capitalize ${conflictTab === t ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>
                    {t === 'roster' ? '🗓️ Roster Grid' : `🚨 Conflicts (${preview.conflicts.length})`}
                  </button>
                ))}
              </div>

              {conflictTab === 'roster' && (
                <div className="card p-0 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">Draft Roster Preview</p>
                    <p className="text-xs text-slate-500">{preview.shifts.length} shifts · {daysBetween(startDate, endDate).length} days</p>
                  </div>
                  <div className="p-2">
                    <RosterGrid shifts={preview.shifts.map(s => ({
                      ...s,
                      userName:   userMap[s.userId]?.name ?? s.userId,
                      employeeId: userMap[s.userId]?.employeeId ?? '',
                      department: userMap[s.userId]?.department ?? '',
                    }))} days={days} userMap={userMap} />
                  </div>
                </div>
              )}

              {conflictTab === 'conflicts' && (
                <div className="card space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-sm font-semibold text-slate-700">
                      {preview.conflicts.length} conflict{preview.conflicts.length !== 1 ? 's' : ''} detected
                    </p>
                    <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="input-field text-xs w-auto">
                      <option value="All">All</option>
                      <option value="critical">Critical only</option>
                      <option value="warning">Warnings only</option>
                    </select>
                  </div>
                  {filteredConflicts.length === 0
                    ? <p className="text-emerald-600 text-sm text-center py-4">✅ No conflicts match current filter</p>
                    : filteredConflicts.map((c, i) => <ConflictRow key={i} c={c} />)
                  }
                </div>
              )}
            </div>
          )}

          {!preview && !generating && (
            <div className="card text-center py-12 text-slate-400">
              <p className="text-4xl mb-3">🗓️</p>
              <p className="font-semibold text-slate-600">Generate a draft roster to get started</p>
              <p className="text-sm mt-1">The engine will assign staff based on coverage rules, rest requirements, and certifications.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Coverage Rules tab ─────────────────────────────────────────────── */}
      {subTab === 'rules' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-1">Coverage Rules</h3>
            <p className="text-xs text-slate-500 mb-4">
              These rules define the minimum staffing requirements the roster engine enforces per shift slot.
              Staff will only be assigned if they hold the required certifications.
            </p>
            <CoverageRulesRef rules={templates?.rules} loading={templatesLoading} />
          </div>

          {templates?.templates && (
            <div className="card">
              <h3 className="font-semibold text-slate-700 mb-3">Shift Templates</h3>
              <div className="flex flex-wrap gap-3">
                {templates.templates.map(t => (
                  <div key={t.id} className="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
                    <p className="font-semibold text-slate-700">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.startHour}:00 – {t.endHour % 24 || '00'}:00 ({t.durationH} h)</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {templates?.staff && (
            <div className="card overflow-x-auto">
              <h3 className="font-semibold text-slate-700 mb-3">Staff Certifications</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Employee', 'ID', 'Department', 'Role', 'Certifications'].map(h => (
                      <th key={h} className="pb-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {templates.staff.map(u => (
                    <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 font-medium text-slate-800">{u.name}</td>
                      <td className="py-2 text-slate-500">{u.employeeId}</td>
                      <td className="py-2 text-slate-500">{u.department}</td>
                      <td className="py-2 text-slate-500">{u.role}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {u.certLabels.length
                            ? u.certLabels.map(c => (
                                <span key={c} className="text-xs bg-blue-50 border border-blue-100 text-blue-700 rounded-full px-2 py-0.5">🎓 {c}</span>
                              ))
                            : <span className="text-xs text-slate-400">—</span>
                          }
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Saved Rosters tab ─────────────────────────────────────────────── */}
      {subTab === 'saved' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{rosters.length} roster{rosters.length !== 1 ? 's' : ''}</p>
            <button onClick={fetchRosters} className="btn-secondary text-xs py-1.5 px-3">↻ Refresh</button>
          </div>

          {rostersLoading && (
            <div className="text-center py-10 text-slate-400">
              <p className="text-3xl mb-2">⏳</p><p>Loading rosters…</p>
            </div>
          )}

          {!rostersLoading && rosters.length === 0 && (
            <div className="card text-center py-10 text-slate-400">
              <p className="text-3xl mb-2">🗂️</p>
              <p className="font-semibold text-slate-600">No saved rosters yet</p>
              <p className="text-sm mt-1">Use the Generate tab to create your first roster.</p>
            </div>
          )}

          {!rostersLoading && rosters.map(r => (
            <SavedRosterCard
              key={r.id}
              roster={r}
              onView={handleViewRoster}
              onDelete={handleDeleteRoster}
              onPublish={handlePublish}
            />
          ))}

          {/* In-line roster detail */}
          {viewLoading && (
            <div className="card text-center py-8 text-slate-400">
              <p className="text-3xl mb-2">⏳</p><p>Loading roster…</p>
            </div>
          )}

          {viewRoster && !viewLoading && (
            <div className="card p-0 overflow-hidden border-blue-200 border-2">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-100">
                <div>
                  <p className="font-bold text-slate-800">{viewRoster.roster.name}</p>
                  <p className="text-xs text-slate-500">{viewRoster.roster.startDate} → {viewRoster.roster.endDate}</p>
                </div>
                <div className="flex gap-2 items-center">
                  <ConflictSummaryBar summary={viewRoster.summary} />
                  {viewRoster.roster.status !== 'Published' && (
                    <button onClick={() => handlePublish(null)} className="btn-primary text-sm py-1.5 px-4 ml-2">
                      Publish
                    </button>
                  )}
                  <button onClick={() => setViewRoster(null)} className="text-slate-400 text-lg ml-2">✕</button>
                </div>
              </div>

              {/* Roster grid / conflicts tabs */}
              <div className="p-3 space-y-3">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit text-sm">
                  {['roster', 'conflicts'].map(t => (
                    <button key={t} onClick={() => setConflictTab(t)}
                      className={`px-3 py-1.5 rounded-md font-medium transition-colors capitalize ${conflictTab === t ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>
                      {t === 'roster' ? '🗓️ Roster Grid' : `🚨 Conflicts (${viewRoster.conflicts.length})`}
                    </button>
                  ))}
                </div>

                {conflictTab === 'roster' && (
                  <RosterGrid
                    shifts={viewRoster.shifts}
                    days={daysBetween(viewRoster.roster.startDate, viewRoster.roster.endDate)}
                    userMap={userMap}
                  />
                )}

                {conflictTab === 'conflicts' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-sm font-semibold text-slate-700">
                        {viewRoster.conflicts.length} conflict{viewRoster.conflicts.length !== 1 ? 's' : ''}
                      </p>
                      <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="input-field text-xs w-auto">
                        <option value="All">All</option>
                        <option value="critical">Critical only</option>
                        <option value="warning">Warnings only</option>
                      </select>
                    </div>
                    {filteredConflicts.length === 0
                      ? <p className="text-emerald-600 text-sm text-center py-4">✅ No conflicts match filter</p>
                      : filteredConflicts.map((c, i) => <ConflictRow key={i} c={c} />)
                    }
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
