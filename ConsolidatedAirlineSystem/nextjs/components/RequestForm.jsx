'use client'
import { useState, useEffect } from 'react'
import { shiftService } from '@/lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function RequestForm({ shift, requestType, onClose, onSubmitted }) {
  const [reason, setReason] = useState('')
  const [targetUserId, setTargetUserId] = useState('')
  const [targetShiftId, setTargetShiftId] = useState('')
  const [proposedStart, setProposedStart] = useState('')
  const [proposedEnd, setProposedEnd] = useState('')
  const [colleagues, setColleagues] = useState([])
  const [colleagueShifts, setColleagueShifts] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (requestType === 'Swap') {
      shiftService.getUsers().then(users =>
        setColleagues(users.filter(u => u.role === 'Staff' || u.role === 'Agent'))
      ).catch(() => {})
    }
  }, [requestType])

  useEffect(() => {
    if (targetUserId) {
      shiftService.getAllShifts().then(shifts =>
        setColleagueShifts(shifts.filter(s => s.userId === targetUserId && s.status === 'Scheduled'))
      ).catch(() => {})
    }
  }, [targetUserId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!reason.trim()) { toast.error('Please provide a reason'); return }
    setLoading(true)
    try {
      await shiftService.submitRequest({
        shiftId: shift.id, requestType, reason,
        targetUserId: targetUserId || undefined,
        targetShiftId: targetShiftId || undefined,
        proposedStartTime: proposedStart || undefined,
        proposedEndTime: proposedEnd || undefined,
      })
      toast.success(`${requestType} request submitted!`)
      onSubmitted?.()
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">{requestType} Request</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50 rounded-lg p-3 text-sm">
            <p className="font-semibold text-blue-800">{shift.shiftType} Shift</p>
            <p className="text-blue-600">{format(new Date(shift.startTime), 'EEE, MMM d · HH:mm')} – {format(new Date(shift.endTime), 'HH:mm')}</p>
            <p className="text-blue-500 text-xs">{shift.location}</p>
          </div>

          {requestType === 'Change' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Proposed Start</label>
                <input type="datetime-local" value={proposedStart} onChange={e => setProposedStart(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Proposed End</label>
                <input type="datetime-local" value={proposedEnd} onChange={e => setProposedEnd(e.target.value)} className="input-field" />
              </div>
            </div>
          )}

          {requestType === 'Swap' && (
            <>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Select Colleague</label>
                <select value={targetUserId} onChange={e => { setTargetUserId(e.target.value); setTargetShiftId('') }} className="input-field">
                  <option value="">-- Select colleague --</option>
                  {colleagues.map(c => <option key={c.id} value={c.id}>{c.name} ({c.employeeId})</option>)}
                </select>
              </div>
              {targetUserId && (
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Their Shift to Swap</label>
                  <select value={targetShiftId} onChange={e => setTargetShiftId(e.target.value)} className="input-field">
                    <option value="">-- Select their shift --</option>
                    {colleagueShifts.map(s => (
                      <option key={s.id} value={s.id}>{format(new Date(s.startTime), 'MMM d HH:mm')} – {s.shiftType} @ {s.location}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Reason *</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Explain your reason..." className="input-field resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Submitting...' : 'Submit Request'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
