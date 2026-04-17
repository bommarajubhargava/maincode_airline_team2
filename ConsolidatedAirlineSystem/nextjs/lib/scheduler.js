/**
 * Scheduling Engine
 *
 * Exports:
 *   SHIFT_TEMPLATES      – standard shift slot definitions
 *   COVERAGE_RULES       – per-location/role minimum-staffing rules
 *   CERT_LABELS          – human-readable certificate names
 *   EMPLOYEE_CERTS       – mock certification registry (userId → string[])
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
    role:        'Staff',
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
    department:  null,
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
    shiftTypes:  ['Morning', 'Afternoon'],
    role:        'Staff',
    department:  'Operations',
    minStaff:    2,
    certRequired: ['security-screening'],
    description: 'Minimum 2 security-screened Operations staff at checkpoint during peak hours',
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
    shiftTypes:  ['Morning', 'Afternoon'],
    role:        'Staff',
    department:  null,
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
    shiftTypes:  ['Morning'],
    role:        null,
    department:  null,
    minStaff:    2,
    certRequired: ['catering-hygiene'],
    description: 'Minimum 2 catering-certified staff for morning meal loading',
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

// Assigned by department/role pattern
export const EMPLOYEE_CERTS = {
  // Ground Services → airside-vehicle
  'usr-003': ['airside-vehicle', 'dangerous-goods'],
  'usr-004': ['airside-vehicle'],
  'usr-014': ['airside-vehicle', 'dangerous-goods'],
  'usr-018': ['airside-vehicle'],
  'usr-021': ['airside-vehicle'],
  // Operations → security-screening
  'usr-001': ['security-screening'],
  'usr-002': ['security-screening'],
  'usr-011': ['security-screening'],
  'usr-017': ['security-screening'],
  'usr-022': ['security-screening'],
  // Cabin Crew → catering-hygiene
  'usr-005': ['catering-hygiene', 'passenger-assist'],
  'usr-012': ['catering-hygiene', 'passenger-assist'],
  'usr-016': ['catering-hygiene', 'passenger-assist'],
  'usr-020': ['catering-hygiene', 'passenger-assist'],
  // Customer Service → passenger-assist
  'usr-006': ['passenger-assist'],
  'usr-007': ['passenger-assist'],
  'usr-013': ['passenger-assist'],
  'usr-015': ['passenger-assist'],
  'usr-019': ['passenger-assist'],
  'usr-023': ['passenger-assist'],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const toDay = (d) => new Date(d).toISOString().slice(0, 10)
const spanH = (a, b) => (new Date(b) - new Date(a)) / 3_600_000

// ── Auto-generate Draft Roster ────────────────────────────────────────────────

/**
 * Greedily assigns staff to satisfy every COVERAGE_RULE for each day/shift
 * slot in the given date range.
 *
 * Constraints honoured during assignment:
 *   - Role/department/certification filter
 *   - No overlapping shifts (existing or already-drafted)
 *   - Minimum 11 h rest between consecutive shifts
 *   - Load-balanced: staff with fewest draft-hours are preferred
 *
 * @param {{ startDate: string, endDate: string }} params
 * @param {object[]} existingShifts  Live DB shifts (used for overlap + rest checks)
 * @param {object[]} users           Schedulable users (Staff + Agent)
 * @returns {object[]}               Draft shift objects (status = 'Draft')
 */
export function generateDraftRoster({ startDate, endDate }, existingShifts, users) {
  const start = new Date(startDate); start.setHours(0, 0, 0, 0)
  const end   = new Date(endDate);   end.setHours(23, 59, 59, 999)

  const draft       = []
  const draftHoursH = {}       // userId → total hours assigned in this draft
  // Use a per-call counter combined with a random suffix to guarantee global uniqueness
  const seed = Date.now()
  let   seq  = 0
  const nextId = () => `dr-${seed}-${String(++seq).padStart(4, '0')}`

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = new Date(d); day.setHours(0, 0, 0, 0)

    for (const tmpl of SHIFT_TEMPLATES) {
      const sStart = new Date(day); sStart.setHours(tmpl.startHour, 0, 0, 0)
      const sEnd   = new Date(day); sEnd.setHours(tmpl.endHour % 24, 0, 0, 0)
      if (tmpl.endHour >= 24) sEnd.setDate(sEnd.getDate() + 1)

      for (const rule of COVERAGE_RULES.filter(r => r.shiftTypes.includes(tmpl.name))) {
        // Count already-drafted staff satisfying this rule slot
        const alreadySatisfied = draft.filter(
          s => s.location  === rule.location &&
               s.shiftType === tmpl.name &&
               toDay(s.startTime) === toDay(sStart)
        ).length

        if (alreadySatisfied >= rule.minStaff) continue

        // Build eligible pool: role + dept + cert checks
        const pool = users.filter(u => {
          if (rule.role       && u.role       !== rule.role)       return false
          if (rule.department && u.department !== rule.department)  return false
          if (rule.certRequired?.length) {
            const certs = EMPLOYEE_CERTS[u.id] ?? []
            if (!rule.certRequired.every(c => certs.includes(c))) return false
          }
          return true
        })

        // Sort by fewest assigned draft-hours (load-balance)
        const sorted = [...pool].sort(
          (a, b) => (draftHoursH[a.id] ?? 0) - (draftHoursH[b.id] ?? 0)
        )

        let assigned = alreadySatisfied
        for (const user of sorted) {
          if (assigned >= rule.minStaff) break

          // Skip if overlapping with any existing or draft shift
          const allShifts = [...existingShifts, ...draft]
          const overlap = allShifts.some(s => {
            if (s.userId !== user.id || s.status === 'Cancelled') return false
            const eS = new Date(s.startTime), eE = new Date(s.endTime)
            return eS < sEnd && eE > sStart
          })
          if (overlap) continue

          // Enforce minimum rest
          const priorShifts = allShifts
            .filter(s => s.userId === user.id && s.status !== 'Cancelled' && new Date(s.endTime) <= sStart)
            .sort((a, b) => new Date(b.endTime) - new Date(a.endTime))

          if (priorShifts.length && spanH(priorShifts[0].endTime, sStart) < RULES.MIN_REST_HOURS) continue

          const sh = {
            id:        nextId(),
            userId:    user.id,
            startTime: sStart.toISOString(),
            endTime:   sEnd.toISOString(),
            location:  rule.location,
            shiftType: tmpl.name,
            duty:      rule.duty ?? 'General',
            status:    'Draft',
          }
          draft.push(sh)
          draftHoursH[user.id] = (draftHoursH[user.id] ?? 0) + tmpl.durationH
          assigned++
        }
      }
    }
  }

  return draft
}

// ── Conflict Detection ────────────────────────────────────────────────────────

/**
 * Checks a draft roster for all conflict types:
 *   COVERAGE_GAP    – a coverage rule cannot be fully met (critical)
 *   REST_PERIOD etc – compliance rules violated by adding draft shifts (varies)
 *   MISSING_CERT    – staff lacks required cert for assigned location (critical)
 *
 * @param {object[]} draftShifts
 * @param {object[]} existingShifts
 * @param {object[]} users           Schedulable users with { id, name, ... }
 * @param {string}   startDate
 * @param {string}   endDate
 * @returns {object[]}  Conflict objects sorted critical first
 */
export function checkRosterConflicts(draftShifts, existingShifts, users, startDate, endDate) {
  const conflicts = []
  const start = new Date(startDate); start.setHours(0, 0, 0, 0)
  const end   = new Date(endDate);   end.setHours(23, 59, 59, 999)

  // ── 1. Coverage gaps ──────────────────────────────────────────────────────
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = toDay(d)
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

  // De-duplicate coverage gaps (one per rule+day+shiftType)
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
