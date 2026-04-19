'use client'
import { useState, useEffect, useCallback } from 'react'
import CompliancePanel from '@/components/CompliancePanel'
import toast from 'react-hot-toast'

const AIRPORTS = [
  { id: 'ALL', name: 'All Airports' },
  { id: 'YYZ', name: 'Toronto Pearson International' },
  { id: 'YTZ', name: 'Billy Bishop Toronto City' },
  { id: 'YHM', name: 'John C. Munro Hamilton' },
]

export default function AdminCompliancePage() {
  const [airport, setAirport] = useState('YYZ')
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchCompliance = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (airport !== 'ALL') params.set('airport', airport)
      const res = await fetch(`/api/shifts/compliance?${params}`)
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (err) {
      toast.error('Failed to load compliance data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [airport])

  useEffect(() => { fetchCompliance() }, [fetchCompliance])

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Compliance</h1>
          <p className="text-slate-500 text-sm">Shift compliance checks across airports</p>
        </div>
        <div className="flex items-center gap-2">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Airport</label>
            <select
              value={airport}
              onChange={e => setAirport(e.target.value)}
              className="input-field text-sm"
            >
              {AIRPORTS.map(a => (
                <option key={a.id} value={a.id}>{a.id === 'ALL' ? a.name : `${a.id} — ${a.name}`}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <CompliancePanel data={data} loading={loading} onRefresh={fetchCompliance} />
    </div>
  )
}
