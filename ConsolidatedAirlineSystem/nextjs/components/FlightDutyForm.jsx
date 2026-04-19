'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

function ChecklistForm({ duty, onSubmit, submitting }) {
  const [checked, setChecked] = useState({})
  const allDone = duty.items.every(item => checked[item])
  const toggle = (item) => setChecked(prev => ({ ...prev, [item]: !prev[item] }))

  return (
    <div className="space-y-2">
      {duty.items.map(item => (
        <label key={item} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked[item] ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
          <input type="checkbox" checked={!!checked[item]} onChange={() => toggle(item)} className="w-4 h-4 accent-emerald-600 shrink-0" />
          <span className={`text-sm ${checked[item] ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item}</span>
        </label>
      ))}
      <div className="pt-3 flex items-center justify-between">
        <span className="text-xs text-slate-500">{Object.values(checked).filter(Boolean).length} / {duty.items.length} completed</span>
        <button onClick={() => onSubmit({ checklist: checked })} disabled={!allDone || submitting}
          className="btn-primary text-sm px-5 disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? 'Submitting…' : 'Submit Duty'}
        </button>
      </div>
    </div>
  )
}

function FieldForm({ duty, onSubmit, submitting }) {
  const [values, setValues] = useState({})
  const set = (key, val) => setValues(prev => ({ ...prev, [key]: val }))
  const allRequired = duty.fields.filter(f => f.required).every(f => {
    const v = values[f.key]
    if (f.type === 'checkbox') return v === true
    return v !== undefined && v !== '' && v !== null
  })

  return (
    <div className="space-y-3">
      {duty.fields.map(field => (
        <div key={field.key}>
          {field.type === 'checkbox' ? (
            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${values[field.key] ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
              <input type="checkbox" checked={!!values[field.key]} onChange={e => set(field.key, e.target.checked)} className="w-4 h-4 accent-emerald-600 shrink-0" />
              <span className="text-sm text-slate-700">{field.label}</span>
              {field.required && <span className="text-red-400 text-xs ml-auto">Required</span>}
            </label>
          ) : field.type === 'select' ? (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">{field.label}{field.required && <span className="text-red-400 ml-1">*</span>}</label>
              <select value={values[field.key] ?? ''} onChange={e => set(field.key, e.target.value)} className="input-field">
                <option value="">Select…</option>
                {field.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">{field.label}{field.required && <span className="text-red-400 ml-1">*</span>}</label>
              <input type={field.type} value={values[field.key] ?? ''} onChange={e => set(field.key, e.target.value)} className="input-field" placeholder={field.type === 'number' ? '0' : ''} />
            </div>
          )}
        </div>
      ))}
      <div className="pt-3 flex justify-end">
        <button onClick={() => { if (!allRequired) { toast.error('Please fill all required fields'); return } onSubmit(values) }}
          disabled={!allRequired || submitting}
          className="btn-primary text-sm px-5 disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? 'Submitting…' : 'Submit Duty'}
        </button>
      </div>
    </div>
  )
}

export default function FlightDutyForm({ duty, flightId, onCompleted, viewOnly = false, responsibleStaff = [] }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // canPerform: from duty prop. viewOnly: future flight or cancelled
  const canAct = duty.canPerform && !viewOnly && !duty.completed
  const disabledReason = duty.completed ? null
    : viewOnly ? 'View only'
    : !duty.canPerform ? 'Not assigned to you'
    : null

  const handleSubmit = async (formData) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/flights/${flightId}/duties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dutyKey: duty.key, formData }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.message) }
      toast.success(`${duty.label} marked complete!`)
      setOpen(false)
      onCompleted?.()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  return (
    <div className={`rounded-xl border transition-all ${duty.completed ? 'border-emerald-200 bg-emerald-50' : disabledReason ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white'}`}>
      {/* Header row */}
      <button
        onClick={() => (canAct || duty.completed) && setOpen(o => !o)}
        className={`w-full flex items-center gap-3 p-4 text-left rounded-xl ${canAct ? 'hover:bg-blue-50 cursor-pointer' : duty.completed ? 'cursor-pointer' : 'cursor-default'}`}>
        <span className="text-2xl shrink-0">{duty.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm ${duty.completed ? 'text-emerald-700' : disabledReason ? 'text-slate-400' : 'text-slate-800'}`}>{duty.label}</p>
          <p className="text-xs text-slate-500 truncate">{duty.description}</p>
        </div>
        {duty.completed ? (
          <span className="shrink-0 text-xs font-medium bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">Done ✓</span>
        ) : disabledReason ? (
          <span className="shrink-0 text-xs font-medium bg-slate-100 text-slate-400 px-2.5 py-1 rounded-full">{disabledReason}</span>
        ) : (
          <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${open ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
            {open ? 'Close ▲' : 'Start ▼'}
          </span>
        )}
      </button>

      {/* Completed info */}
      {duty.completed && duty.log && (
        <div className="px-4 pb-3 text-xs text-emerald-600">
          Completed at {new Date(duty.log.completed_at).toLocaleTimeString()}
        </div>
      )}

      {/* Expandable form */}
      {open && canAct && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
          {duty.type === 'checklist'
            ? <ChecklistForm duty={duty} onSubmit={handleSubmit} submitting={submitting} />
            : <FieldForm duty={duty} onSubmit={handleSubmit} submitting={submitting} />
          }
        </div>
      )}
    </div>
  )
}
