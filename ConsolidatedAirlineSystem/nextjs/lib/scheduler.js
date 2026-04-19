/**
 * Scheduling Engine
 *
 * Exports:
 *   SHIFT_TEMPLATES      – standard shift slot definitions
 *   COVERAGE_RULES       – per-location/role minimum-staffing rules
 *   CERT_LABELS          – human-readable certificate names
 *   EMPLOYEE_CERTS       – certification registry (userId → string[])
 *   generateDraftRoster  – auto-assign staff to satisfy coverage rules
 *   checkRosterConflicts – flag coverage gaps, compliance violations, missing certs
 */

import { checkUserCompliance, RULES } from './compliance.js'

// ── Shift Templates ───────────────────────────────────────────────────────────

export const SHIFT_TEMPLATES = [
  { id: 'tmpl-morning',   name: 'Morning',   startHour: 6,  endHour: 14, durationH: 8,  color: 'blue'   },
  { id: 'tmpl-afternoon', name: 'Afternoon', startHour: 14, endHour: 22, durationH: 8,  color: 'amber'  },
  { id: 'tmpl-night',     name: 'Night',     startHour: 22, endHour: 30, durationH: 8,  color: 'indigo' },
]

// ── Coverage Rules ────────────────────────────────────────────────────────────

export const COVERAGE_RULES = [
  {
    id:          'cvr-001',
    name:        'Ramp GSE – Aircraft Turns',
    icon:        '🛫',
    location:    'Runway Control',
    duty:        'General',
    shiftTypes:  ['Morning', 'Afternoon', 'Night'],
    role:        'Agent',
    department:  'Ground Services',
    minStaff:    2,
    certRequired: ['airside-vehicle'],
    description: 'Minimum 2 GSE-certified staff on ramp during aircraft turns',
  },
  {
    id:          'cvr-002',
    name:        'Terminal Check-in Coverage',
    icon:        '🎫',
    location:    'Terminal 1 - Check-in',
    duty:        'General',
    shiftTypes:  ['Morning', 'Afternoon'],
    role:        'Agent',
    department:  'Customer Service',
    minStaff:    2,
    certRequired: ['passenger-assist'],
    description: 'Minimum 2 passenger-service agents at check-in during peak hours',
  },
  {
    id:          'cvr-003',
    name:        'Security Checkpoint Staffing',
    icon:        '🛡️',
    location:    'Security Checkpoint',
    duty:        'General',
    shiftTypes:  ['Morning', 'Afternoon', 'Night'],
    role:        'Agent',
    department:  'Operations',
    minStaff:    2,
    certRequired: ['security-screening'],
    description: 'Minimum 2 security-screened staff at checkpoint',
  },
  {
    id:          'cvr-004',
    name:        'Customer Service Desk',
    icon:        '💬',
    location:    'Customer Service Desk',
    duty:        'General',
    shiftTypes:  ['Morning', 'Afternoon', 'Night'],
    role:        'Agent',
    department:  'Customer Service',
    minStaff:    1,
    certRequired: [],
    description: 'At least 1 customer service agent on desk at all times',
  },
  {
    id:          'cvr-005',
    name:        'Gate Boarding Staff',
    icon:        '🚪',
    location:    'Terminal 3 - Boarding',
    duty:        'General',
    shiftTypes:  ['Morning', 'Afternoon', 'Night'],
    role:        'Agent',
    department:  'Gate Services',
    minStaff:    1,
    certRequired: [],
    description: 'At least 1 staff member at boarding gate during departure windows',
  },
  {
    id:          'cvr-006',
    name:        'Catering Load Team',
    icon:        '🍱',
    location:    'Terminal 2 - Gate A3',
    duty:        'Catering',
    shiftTypes:  ['Morning', 'Afternoon'],
    role:        'Agent',
    department:  'Catering Services',
    minStaff:    2,
    certRequired: ['catering-hygiene'],
    description: 'Minimum 2 catering-certified staff for meal loading',
  },
]

// ── Certifications ────────────────────────────────────────────────────────────

export const CERT_LABELS = {
  'airside-vehicle':    'Airside Vehicle Permit',
  'security-screening': 'Security Screening',
  'catering-hygiene':   'Catering Hygiene',
  'passenger-assist':   'Passenger Assistance',
  'dangerous-goods':    'Dangerous Goods Handling',
}

// Certification registry keyed by employee DB id
export const EMPLOYEE_CERTS = {
  // ── YYZ ──────────────────────────────────────────────────────────────────
  'emp-yyz-gs1':   ['airside-vehicle'],
  'emp-yyz-gs2':   ['airside-vehicle'],
  'emp-yyz-gs3':   ['airside-vehicle', 'dangerous-goods'],
  'emp-yyz-gs4':   ['airside-vehicle', 'dangerous-goods'],
  'emp-yyz-sec1':  ['security-screening'],
  'emp-yyz-sec2':  ['security-screening'],
  'emp-yyz-sec3':  ['security-screening'],
  'emp-yyz-cs1':   ['passenger-assist'],
  'emp-yyz-cs2':   ['passenger-assist'],
  'emp-yyz-cs3':   ['passenger-assist'],
  'emp-yyz-cs4':   ['passenger-assist'],
  'emp-yyz-cat1':  ['catering-hygiene', 'passenger-assist'],
  'emp-yyz-cat2':  ['catering-hygiene', 'passenger-assist'],
  'emp-yyz-gate1': ['passenger-assist'],
  'emp-yyz-gate2': ['passenger-assist'],
  'emp-yyz-gate3': ['passenger-assist'],
  // ── YTZ ──────────────────────────────────────────────────────────────────
  'emp-ytz-gs1':   ['airside-vehicle'],
  'emp-ytz-gs2':   ['airside-vehicle'],
  'emp-ytz-gs3':   ['airside-vehicle', 'dangerous-goods'],
  'emp-ytz-gs4':   ['airside-vehicle', 'dangerous-goods'],
  'emp-ytz-sec1':  ['security-screening'],
  'emp-ytz-sec2':  ['security-screening'],
  'emp-ytz-sec3':  ['security-screening'],
  'emp-ytz-cs1':   ['passenger-assist'],
  'emp-ytz-cs2':   ['passenger-assist'],
  'emp-ytz-cs3':   ['passenger-assist'],
  'emp-ytz-cs4':   ['passenger-assist'],
  'emp-ytz-cat1':  ['catering-hygiene', 'passenger-assist'],
  'emp-ytz-cat2':  ['catering-hygiene', 'passenger-assist'],
  'emp-ytz-gate1': ['passenger-assist'],
  'emp-ytz-gate2': ['passenger-assist'],
  'emp-ytz-gate3': ['passenger-assist'],
  // ── YHM ──────────────────────────────────────────────────────────────────
  'emp-yhm-gs1':   ['airside-vehicle'],
  'emp-yhm-gs2':   ['airside-vehicle'],
  'emp-yhm-gs3':   ['airside-vehicle', 'dangerous-goods'],
  'emp-yhm-gs4':   ['airside-vehicle', 'dangerous-goods'],
  'emp-yhm-sec1':  ['security-screening'],
  'emp-yhm-sec2':  ['security-screening'],
  'emp-yhm-sec3':  ['security-screening'],
  'emp-yhm-cs1':   ['passenger-assist'],
  'emp-yhm-cs2':   ['passenger-assist'],
  'emp-yhm-cs3':   ['passenger-assist'],
  'emp-yhm-cs4':   ['passenger-assist'],
  'emp-yhm-cat1':  ['catering-hygiene', 'passenger-assist'],
  'emp-yhm-cat2':  ['catering-hygiene', 'passenger-assist'],
  'emp-yhm-gate1': ['passenger-assist'],
  'emp-yhm-gate2': ['passenger-assist'],
  'emp-yhm-gate3': ['passenger-assist'],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const toDay = (d) => new Date(d).toISOString().slice(0, 10)
const spanH = (a, b) => (new Date(b) - new Date(a)) / 3_600_000

const utcDay = (dateStr) => new Date(dateStr + 'T00:00:00Z')

// ── Auto-generate Draft Roster ────────────────────────────────────────────────

export function generateDraftRoster({ startDate, endDate }, existingShifts, users) {
  // Parse dates as UTC midnight to avoid local-timezone drift
  const start = utcDay(startDate)
  const end   = utcDay(endDate); end.setUTCHours(23, 59, 59, 999)

  const draft       = []
  const draftHoursH = {}
  const seed = Date.now()
  let   seq  = 0
  const nextId = () => `dr-${seed}-${String(++seq).padStart(4, '0')}`

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dayStr = d.toISOString().slice(0, 10)

    for (const tmpl of SHIFT_TEMPLATES) {
      const sStart = utcDay(dayStr); sStart.setUTCHours(tmpl.startHour, 0, 0, 0)
      const sEnd   = utcDay(dayStr); sEnd.setUTCHours(tmpl.endHour % 24, 0, 0, 0)
      if (tmpl.endHour >= 24) sEnd.setUTCDate(sEnd.getUTCDate() + 1)

      for (const rule of COVERAGE_RULES.filter(r => r.shiftTypes.includes(tmpl.name))) {
        const alreadySatisfied = draft.filter(
          s => s.location  === rule.location &&
               s.shiftType === tmpl.name &&
               toDay(s.startTime) === dayStr
        ).length

        if (alreadySatisfied >= rule.minStaff) continue

        const pool = users.filter(u => {
          if (rule.role       && u.role       !== rule.role)       return false
          if (rule.department && u.department !== rule.department)  return false
          if (rule.certRequired?.length) {
            const certs = EMPLOYEE_CERTS[u.id] ?? []
            if (!rule.certRequired.every(c => certs.includes(c))) return false
          }
          return true
        })

        const sorted = [...pool].sort(
          (a, b) => (draftHoursH[a.id] ?? 0) - (draftHoursH[b.id] ?? 0)
        )

        let assigned = alreadySatisfied
        for (const user of sorted) {
          if (assigned >= rule.minStaff) break

          const allShifts = [...existingShifts, ...draft]
          const overlap = allShifts.some(s => {
            if (s.userId !== user.id || s.status === 'Cancelled') return false
            const eS = new Date(s.startTime), eE = new Date(s.endTime)
            return eS < sEnd && eE > sStart
          })
          if (overlap) continue

          const priorShifts = allShifts
            .filter(s => s.userId === user.id && s.status !== 'Cancelled' && new Date(s.endTime) <= sStart)
            .sort((a, b) => new Date(b.endTime) - new Date(a.endTime))

          if (priorShifts.length && spanH(priorShifts[0].endTime, sStart) < RULES.MIN_REST_HOURS) continue

          draft.push({
            id:        nextId(),
            userId:    user.id,
            startTime: sStart.toISOString(),
            endTime:   sEnd.toISOString(),
            location:  rule.location,
            shiftType: tmpl.name,
            duty:      rule.duty ?? 'General',
            status:    'Draft',
          })
          draftHoursH[user.id] = (draftHoursH[user.id] ?? 0) + tmpl.durationH
          assigned++
        }
      }
    }
  }

  return draft
}

// ── Conflict Detection ────────────────────────────────────────────────────────

export function checkRosterConflicts(draftShifts, existingShifts, users, startDate, endDate) {
  const conflicts = []
  // Use UTC midnight to avoid local-timezone drift
  const start = utcDay(startDate)
  const end   = utcDay(endDate); end.setUTCHours(23, 59, 59, 999)

  // ── 1. Coverage gaps ──────────────────────────────────────────────────────
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10)
    for (const rule of COVERAGE_RULES) {
      for (const shiftType of rule.shiftTypes) {
        const covered = draftShifts.filter(
          s => toDay(s.startTime) === day &&
               s.shiftType         === shiftType &&
               s.location          === rule.location
        )
        if (covered.length < rule.minStaff) {
          conflicts.push({
            type:     'COVERAGE_GAP',
            severity: 'critical',
            ruleId:   rule.id,
            ruleName: rule.name,
            date:     day,
            shiftType,
            location: rule.location,
            actual:   covered.length,
            required: rule.minStaff,
            message:  `${rule.name}: ${covered.length}/${rule.minStaff} staff on ${day} (${shiftType})`,
          })
        }
      }
    }
  }

  // ── 2. Compliance violations introduced by draft ──────────────────────────
  for (const user of users) {
    const existing  = existingShifts.filter(s => s.userId === user.id && s.status !== 'Cancelled')
    const proposed  = draftShifts.filter(s => s.userId === user.id)
    if (!proposed.length) continue

    const before    = checkUserCompliance(existing, user.id)
    const after     = checkUserCompliance([...existing, ...proposed], user.id)
    const beforeSet = new Set(before.map(v => `${v.type}|${v.date}`))

    for (const v of after.filter(x => !beforeSet.has(`${x.type}|${x.date}`))) {
      conflicts.push({ ...v, source: 'compliance', userName: user.name })
    }
  }

  // ── 3. Missing certifications ─────────────────────────────────────────────
  for (const sh of draftShifts) {
    const rule = COVERAGE_RULES.find(
      r => r.location === sh.location && r.shiftTypes.includes(sh.shiftType)
    )
    if (!rule?.certRequired?.length) continue

    const missing = rule.certRequired.filter(c => !(EMPLOYEE_CERTS[sh.userId] ?? []).includes(c))
    if (!missing.length) continue

    const u = users.find(x => x.id === sh.userId)
    conflicts.push({
      type:         'MISSING_CERT',
      severity:     'critical',
      date:         toDay(sh.startTime),
      shiftType:    sh.shiftType,
      location:     sh.location,
      userId:       sh.userId,
      userName:     u?.name ?? sh.userId,
      shiftId:      sh.id,
      missingCerts: missing,
      message:      `${u?.name ?? sh.userId} lacks: ${missing.map(c => CERT_LABELS[c] ?? c).join(', ')} at ${sh.location}`,
    })
  }

  const seen = new Set()
  const deduped = conflicts.filter(c => {
    if (c.type !== 'COVERAGE_GAP') return true
    const key = `${c.ruleId}|${c.date}|${c.shiftType}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return deduped.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1
  )
}
