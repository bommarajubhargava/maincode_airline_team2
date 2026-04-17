/**
 * Collective Agreement & Fatigue Rules Engine
 *
 * Rules enforced:
 *  REST_PERIOD       – < 11 h rest between consecutive shift end → next shift start  [critical]
 *  CONSECUTIVE_DAYS  – > 6 consecutive calendar working days                         [critical]
 *  MAX_DAILY_HOURS   – > 12 h scheduled within one calendar day                      [critical]
 *  MAX_WEEKLY_HOURS  – > 48 h in any rolling 7-day window (EU WTD hard cap)          [critical]
 *  OVERTIME_DAILY    – > 8 h in a single shift / calendar day                        [warning]
 *  OVERTIME_WEEKLY   – > 40 h in any rolling 7-day window                            [warning]
 *  FATIGUE_ROLLING   – > 60 h in any rolling 14-day fatigue window                   [warning]
 */

// ── Collective-agreement constants ────────────────────────────────────────────

export const RULES = {
  MIN_REST_HOURS:        11,   // minimum rest between shift end and next shift start
  MAX_CONSECUTIVE_DAYS:   6,   // max calendar days worked in a row
  MAX_DAILY_HOURS:       12,   // max hours in one calendar day
  MAX_WEEKLY_HOURS:      48,   // hard weekly cap (rolling 7 days)
  OVERTIME_DAILY_HOURS:   8,   // daily threshold for overtime pay / warning
  OVERTIME_WEEKLY_HOURS: 40,   // weekly threshold for overtime pay / warning
  FATIGUE_ROLLING_HOURS: 60,   // fatigue threshold over rolling window
  FATIGUE_ROLLING_DAYS:  14,   // rolling window length in days
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const toDay = (date) => date.toISOString().slice(0, 10)
const hoursSpan = (start, end) => (end - start) / 3_600_000

// ── Per-user compliance check ─────────────────────────────────────────────────

/**
 * Evaluate all collective-agreement rules for one user's shift list.
 *
 * @param {object[]} shifts   Shift records for a single user
 * @param {string}   userId
 * @returns {object[]}        Array of Violation objects
 */
export function checkUserCompliance(shifts, userId) {
  // Only consider active (non-cancelled) shifts, enriched with Date objects
  const active = shifts
    .filter(s => s.status !== 'Cancelled')
    .map(s => ({
      ...s,
      start: new Date(s.startTime),
      end:   new Date(s.endTime),
      get hours() { return hoursSpan(this.start, this.end) },
    }))
    .sort((a, b) => a.start - b.start)

  const violations = []
  const push = (v) => violations.push({ ...v, userId })

  // ── REST_PERIOD ──────────────────────────────────────────────────────────────
  for (let i = 1; i < active.length; i++) {
    const prev = active[i - 1]
    const curr = active[i]
    const restHours = hoursSpan(prev.end, curr.start)
    if (restHours >= 0 && restHours < RULES.MIN_REST_HOURS) {
      push({
        type:     'REST_PERIOD',
        severity: 'critical',
        message:  `Only ${restHours.toFixed(1)} h rest before shift on ${toDay(curr.start)} (minimum ${RULES.MIN_REST_HOURS} h required)`,
        shiftIds: [prev.id, curr.id],
        date:     toDay(curr.start),
        actual:   +restHours.toFixed(2),
        limit:    RULES.MIN_REST_HOURS,
      })
    }
  }

  // ── Daily grouping (used for MAX_DAILY_HOURS + OVERTIME_DAILY) ───────────────
  const byDay = {}
  for (const s of active) {
    const day = toDay(s.start)
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(s)
  }

  for (const [day, dayShifts] of Object.entries(byDay)) {
    const totalHours = dayShifts.reduce((acc, s) => acc + s.hours, 0)
    if (totalHours > RULES.MAX_DAILY_HOURS) {
      push({
        type:     'MAX_DAILY_HOURS',
        severity: 'critical',
        message:  `${totalHours.toFixed(1)} h scheduled on ${day} (maximum ${RULES.MAX_DAILY_HOURS} h/day)`,
        shiftIds: dayShifts.map(s => s.id),
        date:     day,
        actual:   +totalHours.toFixed(2),
        limit:    RULES.MAX_DAILY_HOURS,
      })
    } else if (totalHours > RULES.OVERTIME_DAILY_HOURS) {
      push({
        type:     'OVERTIME_DAILY',
        severity: 'warning',
        message:  `${totalHours.toFixed(1)} h on ${day} exceeds ${RULES.OVERTIME_DAILY_HOURS} h overtime threshold`,
        shiftIds: dayShifts.map(s => s.id),
        date:     day,
        actual:   +totalHours.toFixed(2),
        limit:    RULES.OVERTIME_DAILY_HOURS,
      })
    }
  }

  // ── CONSECUTIVE_DAYS ─────────────────────────────────────────────────────────
  const allWorkDays = [...new Set(active.map(s => toDay(s.start)))].sort()
  let streak = 1
  let streakDays = allWorkDays.length ? [allWorkDays[0]] : []

  for (let i = 1; i < allWorkDays.length; i++) {
    const diffDays = (new Date(allWorkDays[i]) - new Date(allWorkDays[i - 1])) / 86_400_000
    if (diffDays === 1) {
      streak++
      streakDays.push(allWorkDays[i])
      if (streak > RULES.MAX_CONSECUTIVE_DAYS) {
        const streakShiftIds = active
          .filter(s => streakDays.includes(toDay(s.start)))
          .map(s => s.id)
        push({
          type:     'CONSECUTIVE_DAYS',
          severity: 'critical',
          message:  `${streak} consecutive working days ending ${allWorkDays[i]} (maximum ${RULES.MAX_CONSECUTIVE_DAYS} days)`,
          shiftIds: streakShiftIds,
          date:     allWorkDays[i],
          actual:   streak,
          limit:    RULES.MAX_CONSECUTIVE_DAYS,
        })
      }
    } else {
      streak = 1
      streakDays = [allWorkDays[i]]
    }
  }

  // ── Rolling 7-day windows (MAX_WEEKLY_HOURS + OVERTIME_WEEKLY) ───────────────
  // Anchor each window on the end of each shift to detect the worst window
  for (let i = 0; i < active.length; i++) {
    const windowEnd   = active[i].end
    const windowStart = new Date(windowEnd.getTime() - 7 * 86_400_000)
    const window7 = active.filter(s => s.start >= windowStart && s.end <= windowEnd)
    const weekHours = window7.reduce((acc, s) => acc + s.hours, 0)

    if (weekHours > RULES.MAX_WEEKLY_HOURS) {
      push({
        type:     'MAX_WEEKLY_HOURS',
        severity: 'critical',
        message:  `${weekHours.toFixed(1)} h in 7-day window ending ${toDay(windowEnd)} (maximum ${RULES.MAX_WEEKLY_HOURS} h/week)`,
        shiftIds: window7.map(s => s.id),
        date:     toDay(windowEnd),
        actual:   +weekHours.toFixed(2),
        limit:    RULES.MAX_WEEKLY_HOURS,
      })
    } else if (weekHours > RULES.OVERTIME_WEEKLY_HOURS) {
      push({
        type:     'OVERTIME_WEEKLY',
        severity: 'warning',
        message:  `${weekHours.toFixed(1)} h in 7-day window ending ${toDay(windowEnd)} (overtime >${RULES.OVERTIME_WEEKLY_HOURS} h/week)`,
        shiftIds: window7.map(s => s.id),
        date:     toDay(windowEnd),
        actual:   +weekHours.toFixed(2),
        limit:    RULES.OVERTIME_WEEKLY_HOURS,
      })
    }
  }

  // ── Rolling 14-day fatigue window ────────────────────────────────────────────
  for (let i = 0; i < active.length; i++) {
    const windowEnd   = active[i].end
    const windowStart = new Date(windowEnd.getTime() - RULES.FATIGUE_ROLLING_DAYS * 86_400_000)
    const window14 = active.filter(s => s.start >= windowStart && s.end <= windowEnd)
    const fatigueHours = window14.reduce((acc, s) => acc + s.hours, 0)

    if (fatigueHours > RULES.FATIGUE_ROLLING_HOURS) {
      push({
        type:     'FATIGUE_ROLLING',
        severity: 'warning',
        message:  `${fatigueHours.toFixed(1)} h across ${RULES.FATIGUE_ROLLING_DAYS}-day fatigue window ending ${toDay(windowEnd)} (threshold ${RULES.FATIGUE_ROLLING_HOURS} h)`,
        shiftIds: window14.map(s => s.id),
        date:     toDay(windowEnd),
        actual:   +fatigueHours.toFixed(2),
        limit:    RULES.FATIGUE_ROLLING_HOURS,
      })
    }
  }

  // De-duplicate: one violation of each type per date per user
  const seen = new Set()
  return violations.filter(v => {
    const key = `${v.type}|${v.date}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── System-wide compliance check ─────────────────────────────────────────────

/**
 * Check compliance for every user and return a structured report.
 *
 * @param {object[]} allShifts  All shifts from the database
 * @param {object[]} users      All user records
 * @returns {{ byUser: object, summary: object }}
 */
export function checkAllCompliance(allShifts, users) {
  const byUser = {}
  let totalCritical = 0
  let totalWarning  = 0

  for (const user of users) {
    const userShifts  = allShifts.filter(s => s.userId === user.id)
    const violations  = checkUserCompliance(userShifts, user.id)
    const criticalCount = violations.filter(v => v.severity === 'critical').length
    const warningCount  = violations.filter(v => v.severity === 'warning').length
    const activeShifts  = userShifts.filter(s => s.status !== 'Cancelled')
    const totalHours    = activeShifts.reduce(
      (acc, s) => acc + hoursSpan(new Date(s.startTime), new Date(s.endTime)), 0
    )

    byUser[user.id] = {
      user,
      violations,
      criticalCount,
      warningCount,
      totalHours: +totalHours.toFixed(2),
      scheduledShifts: activeShifts.filter(s => s.status === 'Scheduled').length,
    }

    totalCritical += criticalCount
    totalWarning  += warningCount
  }

  return {
    byUser,
    summary: {
      usersChecked:        users.length,
      usersWithViolations: Object.values(byUser).filter(u => u.violations.length > 0).length,
      totalCritical,
      totalWarning,
      checkedAt: new Date().toISOString(),
    },
  }
}

// ── Fatigue score for a single user ──────────────────────────────────────────

/**
 * Returns hours worked in the last `days` days (default 28).
 * Used to display a rolling fatigue score per employee.
 */
export function getFatigueHours(shifts, days = 28) {
  const cutoff = new Date(Date.now() - days * 86_400_000)
  return shifts
    .filter(s => s.status !== 'Cancelled' && new Date(s.startTime) >= cutoff)
    .reduce((acc, s) => acc + hoursSpan(new Date(s.startTime), new Date(s.endTime)), 0)
}

// ── Preview check (used when approving a swap / new shift) ───────────────────

/**
 * Run compliance against a hypothetical new shift added to a user's schedule.
 * Returns violations that would be introduced, without persisting anything.
 *
 * @param {object[]} existingShifts  Current shifts for the user
 * @param {object}   newShift        Proposed shift { startTime, endTime, status }
 * @param {string}   userId
 * @returns {object[]}               New violations introduced by the proposed shift
 */
export function previewCompliance(existingShifts, newShift, userId) {
  const before = checkUserCompliance(existingShifts, userId)
  const after  = checkUserCompliance([...existingShifts, newShift], userId)

  const beforeKeys = new Set(before.map(v => `${v.type}|${v.date}`))
  return after.filter(v => !beforeKeys.has(`${v.type}|${v.date}`))
}
