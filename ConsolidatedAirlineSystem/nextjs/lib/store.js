import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// On Vercel, process.cwd() is read-only — use /tmp instead
const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(path.join(DATA_DIR, 'airline.db'))

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS shifts (
    id            TEXT PRIMARY KEY,
    userId        TEXT NOT NULL,
    startTime     TEXT NOT NULL,
    endTime       TEXT NOT NULL,
    location      TEXT NOT NULL,
    shiftType     TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'Scheduled'
  );

  CREATE TABLE IF NOT EXISTS requests (
    id                TEXT PRIMARY KEY,
    requestingUserId  TEXT NOT NULL,
    targetUserId      TEXT,
    shiftId           TEXT NOT NULL,
    targetShiftId     TEXT,
    requestType       TEXT NOT NULL,
    reason            TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'Pending',
    managerComment    TEXT,
    createdAt         TEXT NOT NULL,
    proposedStartTime TEXT,
    proposedEndTime   TEXT
  );

  CREATE TABLE IF NOT EXISTS catering_logs (
    id          TEXT PRIMARY KEY,
    flightId    TEXT NOT NULL,
    agentId     TEXT NOT NULL,
    loadedAt    TEXT NOT NULL,
    itemsJson   TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'Loaded'
  );

  CREATE TABLE IF NOT EXISTS cleanup_logs (
    id          TEXT PRIMARY KEY,
    flightId    TEXT NOT NULL,
    agentId     TEXT NOT NULL,
    completedAt TEXT NOT NULL,
    tasksJson   TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'Completed'
  );

  CREATE TABLE IF NOT EXISTS rosters (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    startDate   TEXT NOT NULL,
    endDate     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'Draft',
    createdAt   TEXT NOT NULL,
    createdBy   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS roster_shifts (
    id          TEXT PRIMARY KEY,
    rosterId    TEXT NOT NULL,
    userId      TEXT NOT NULL,
    startTime   TEXT NOT NULL,
    endTime     TEXT NOT NULL,
    location    TEXT NOT NULL,
    shiftType   TEXT NOT NULL,
    duty        TEXT NOT NULL DEFAULT 'General',
    status      TEXT NOT NULL DEFAULT 'Draft'
  );
`)

// ── Migrate: add duty column if missing, then force reseed ───────────────────

const columns = db.prepare('PRAGMA table_info(shifts)').all()
if (!columns.some(c => c.name === 'duty')) {
  db.exec("ALTER TABLE shifts ADD COLUMN duty TEXT NOT NULL DEFAULT 'General'")
  db.exec('DELETE FROM shifts') // force reseed so duties are assigned correctly
}

// ── Seed shifts if empty ──────────────────────────────────────────────────────

function generateShifts() {
  const staffIds = [
    'usr-001','usr-002','usr-003','usr-004','usr-005',
    'usr-006','usr-007','usr-011','usr-012','usr-013',
    'usr-014','usr-015','usr-016','usr-017','usr-018',
    'usr-019','usr-020','usr-021','usr-022','usr-023',
  ]

  const locations = [
    'Terminal 1 - Check-in','Terminal 2 - Gate A3','Terminal 3 - Boarding',
    'Gate B7','Gate C12','Runway Control','Baggage Claim',
    'Customer Service Desk','Security Checkpoint','VIP Lounge',
  ]

  let rng = 42
  const rand = (max) => { rng = ((rng * 1664525) + 1013904223) & 0x7fffffff; return rng % max }

  const today = new Date(); today.setHours(0,0,0,0)
  const shifts = []
  let counter = 1

  for (let day = -5; day < 30; day++) {
    const date    = new Date(today); date.setDate(today.getDate() + day)
    const isPast  = day < 0
    const isToday = day === 0

    // Every employee gets 2 shifts per day: Morning (Catering) + Afternoon (Cleanup)
    for (const userId of staffIds) {
      for (const [shiftType, startH, endH, duty] of [
        ['Morning',   6,  14, 'Catering'],
        ['Afternoon', 14, 22, 'Cleanup'],
      ]) {
        const startTime = new Date(date); startTime.setHours(startH, 0, 0, 0)
        const endTime   = new Date(date); endTime.setHours(endH, 0, 0, 0)

        const pastRoll = rand(10)
        const status = isPast
          ? pastRoll < 7 ? 'Completed' : pastRoll < 9 ? 'Cancelled' : 'Swapped'
          : isToday ? 'Scheduled'
          : rand(10) < 2 ? 'Cancelled' : 'Scheduled'

        shifts.push({
          id: `shft-${String(counter++).padStart(4,'0')}`,
          userId, shiftType, status, duty,
          startTime: startTime.toISOString(),
          endTime:   endTime.toISOString(),
          location:  locations[rand(locations.length)],
        })
      }
    }
  }

  return shifts
}

// ── Compliance violation scenarios (seeded for demo purposes) ─────────────────
// Each scenario deliberately violates one or more collective-agreement rules so
// the Compliance tab has realistic data to display from day one.
//
// Scenarios:
//   A  usr-001 Alice    – Insufficient rest (2 h gap, min 11 h)
//   B  usr-002 Bob      – 7 consecutive working days (max 6)
//   C  usr-003 Carol    – 63 h in 7-day window (hard cap 48 h) + overtime warning
//   D  usr-004 David    – 84 h in 14-day fatigue window (threshold 60 h)
//   E  usr-005 Emma     – 11 h shift (daily overtime warning > 8 h)
//   F  usr-006 Frank    – 45 h in 7 days (weekly overtime warning > 40 h)

function generateComplianceScenarios(today) {
  const scenarios = []
  let cx = 1
  const nextId = () => `shft-cx${String(cx++).padStart(3, '0')}`

  const ts = (offset, h) => {
    const d = new Date(today)
    d.setDate(today.getDate() + offset)
    d.setHours(h, 0, 0, 0)
    return d.toISOString()
  }

  const add = (userId, startOffset, startH, endOffset, endH, shiftType, location) => {
    const startTime = ts(startOffset, startH)
    const status    = new Date(startTime) < today ? 'Completed' : 'Scheduled'
    scenarios.push({
      id: nextId(), userId, shiftType, location, status, duty: 'General',
      startTime,
      endTime: ts(endOffset, endH),
    })
  }

  // A: Insufficient Rest — Alice (usr-001)
  // Night ends Day+2 at 06:00, Morning starts Day+2 at 08:00 → only 2 h rest
  add('usr-001', 1, 22, 2,  6,  'Night',   'Gate B7')
  add('usr-001', 2,  8, 2, 16,  'Morning', 'Terminal 1 - Check-in')

  // B: 7 Consecutive Days — Bob (usr-002)
  // Morning 06:00-14:00 for days +3 to +9 (7 straight days, max is 6)
  for (let i = 3; i <= 9; i++) {
    add('usr-002', i, 6, i, 14, 'Morning', 'Security Checkpoint')
  }

  // C: Weekly Hours > 48 h — Carol (usr-003)
  // 7 days × 9 h = 63 h in rolling 7-day window (critical >48 h, warns at >40 h)
  for (let i = 10; i <= 16; i++) {
    add('usr-003', i, 7, i, 16, 'Morning', 'Terminal 3 - Boarding')
  }

  // D: 14-day Fatigue — David (usr-004)
  // 14 shifts × 6 h = 84 h fatigue window (threshold 60 h)
  for (let i = -6; i <= 7; i++) {
    add('usr-004', i, 14, i, 20, 'Afternoon', 'VIP Lounge')
  }

  // E: Daily Overtime Warning — Emma (usr-005)
  // Single 11 h shift (>8 h overtime threshold, <12 h hard cap → warning only)
  add('usr-005', 2, 6, 2, 17, 'Morning', 'Customer Service Desk')

  // F: Weekly Overtime Warning — Frank (usr-006)
  // 5 days × 9 h = 45 h in rolling week (>40 h warning, <48 h hard cap)
  for (let i = 3; i <= 7; i++) {
    add('usr-006', i, 6, i, 15, 'Morning', 'Gate C12')
  }

  return scenarios
}

const { count }     = db.prepare('SELECT COUNT(*) as count FROM shifts').get()
const { userCount } = db.prepare('SELECT COUNT(DISTINCT userId) as userCount FROM shifts').get()
const { hasCx }     = db.prepare("SELECT COUNT(*) as hasCx FROM shifts WHERE id LIKE 'shft-cx%'").get()

if (count === 0 || userCount < 15 || !hasCx) {
  db.exec('DELETE FROM shifts')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const insert = db.prepare(
    'INSERT INTO shifts (id,userId,startTime,endTime,location,shiftType,status,duty) VALUES (?,?,?,?,?,?,?,?)'
  )
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insert.run(r.id, r.userId, r.startTime, r.endTime, r.location, r.shiftType, r.status, r.duty)
  })
  insertMany([...generateShifts(), ...generateComplianceScenarios(today)])
}

// ── Shifts ────────────────────────────────────────────────────────────────────

export const getShifts = () =>
  db.prepare('SELECT * FROM shifts ORDER BY startTime').all()

export const findShiftById = (id) =>
  db.prepare('SELECT * FROM shifts WHERE id = ?').get(id)

export function updateShift(id, updates) {
  const allowed = ['startTime','endTime','location','shiftType','status','userId','duty']
  const fields  = Object.keys(updates).filter(k => allowed.includes(k))
  if (!fields.length) return findShiftById(id)
  const set = fields.map(k => `${k} = ?`).join(', ')
  db.prepare(`UPDATE shifts SET ${set} WHERE id = ?`).run(...fields.map(k => updates[k]), id)
  return findShiftById(id)
}

export function getTodayDuties(userId) {
  const rows = db.prepare(
    "SELECT duty FROM shifts WHERE userId = ? AND date(startTime, 'localtime') = date('now', 'localtime')"
  ).all(userId)
  return rows.map(r => r.duty)
}

// ── Requests ──────────────────────────────────────────────────────────────────

export const getRequests = () =>
  db.prepare('SELECT * FROM requests ORDER BY createdAt DESC').all()

export const findRequestById = (id) =>
  db.prepare('SELECT * FROM requests WHERE id = ?').get(id)

export function addRequest(data) {
  const { count: maxNum } = db.prepare(
    "SELECT COALESCE(MAX(CAST(REPLACE(id,'req-','') AS INTEGER)),0) as count FROM requests"
  ).get()
  const id = `req-${String(maxNum + 1).padStart(4,'0')}`
  const createdAt = new Date().toISOString()
  db.prepare(`
    INSERT INTO requests
      (id,requestingUserId,targetUserId,shiftId,targetShiftId,requestType,reason,status,managerComment,createdAt,proposedStartTime,proposedEndTime)
    VALUES (?,?,?,?,?,?,?,'Pending',NULL,?,?,?)
  `).run(
    id, data.requestingUserId, data.targetUserId ?? null, data.shiftId,
    data.targetShiftId ?? null, data.requestType, data.reason, createdAt,
    data.proposedStartTime ?? null, data.proposedEndTime ?? null
  )
  return findRequestById(id)
}

export function updateRequest(id, updates) {
  const allowed = ['status','managerComment']
  const fields  = Object.keys(updates).filter(k => allowed.includes(k))
  if (!fields.length) return findRequestById(id)
  const set = fields.map(k => `${k} = ?`).join(', ')
  db.prepare(`UPDATE requests SET ${set} WHERE id = ?`).run(...fields.map(k => updates[k]), id)
  return findRequestById(id)
}

export function deleteRequest(id) {
  const { changes } = db.prepare('DELETE FROM requests WHERE id = ?').run(id)
  return changes > 0
}

// ── Shifts by date ────────────────────────────────────────────────────────────

export const getShiftsByDate = (dateStr) =>
  db.prepare(`SELECT * FROM shifts WHERE date(startTime) = ? ORDER BY startTime`).all(dateStr)

// ── Catering Logs ─────────────────────────────────────────────────────────────

export const getCateringLog = (flightId) =>
  db.prepare('SELECT * FROM catering_logs WHERE flightId = ? ORDER BY loadedAt DESC').get(flightId)

export function addCateringLog(data) {
  const id = `cat-${Date.now()}`
  const loadedAt = new Date().toISOString()
  db.prepare(
    'INSERT INTO catering_logs (id,flightId,agentId,loadedAt,itemsJson,status) VALUES (?,?,?,?,?,?)'
  ).run(id, data.flightId, data.agentId, loadedAt, JSON.stringify(data.items), 'Loaded')
  return getCateringLog(data.flightId)
}

// ── Cleanup Logs ──────────────────────────────────────────────────────────────

export const getCleanupLog = (flightId) =>
  db.prepare('SELECT * FROM cleanup_logs WHERE flightId = ? ORDER BY completedAt DESC').get(flightId)

export function addCleanupLog(data) {
  const id = `cln-${Date.now()}`
  const completedAt = new Date().toISOString()
  db.prepare(
    'INSERT INTO cleanup_logs (id,flightId,agentId,completedAt,tasksJson,status) VALUES (?,?,?,?,?,?)'
  ).run(id, data.flightId, data.agentId, completedAt, JSON.stringify(data.tasks), 'Completed')
  return getCleanupLog(data.flightId)
}

// ── Rosters ───────────────────────────────────────────────────────────────────

export const getRosters = () =>
  db.prepare('SELECT * FROM rosters ORDER BY createdAt DESC').all()

export const findRosterById = (id) =>
  db.prepare('SELECT * FROM rosters WHERE id = ?').get(id)

export const getRosterShifts = (rosterId) =>
  db.prepare('SELECT * FROM roster_shifts WHERE rosterId = ? ORDER BY startTime').all(rosterId)

export function createRoster(data) {
  const id        = `rst-${Date.now()}`
  const createdAt = new Date().toISOString()
  db.prepare(
    `INSERT INTO rosters (id,name,startDate,endDate,status,createdAt,createdBy)
     VALUES (?,?,?,?,'Draft',?,?)`
  ).run(id, data.name, data.startDate, data.endDate, createdAt, data.createdBy)
  return findRosterById(id)
}

export function saveRosterShifts(rosterId, shifts) {
  db.prepare('DELETE FROM roster_shifts WHERE rosterId = ?').run(rosterId)
  const insert = db.prepare(
    `INSERT INTO roster_shifts (id,rosterId,userId,startTime,endTime,location,shiftType,duty,status)
     VALUES (?,?,?,?,?,?,?,?,?)`
  )
  const insertAll = db.transaction((rows) => {
    for (const r of rows)
      insert.run(r.id, rosterId, r.userId, r.startTime, r.endTime, r.location, r.shiftType, r.duty ?? 'General', 'Draft')
  })
  insertAll(shifts)
}

export function publishRoster(rosterId) {
  const roster = findRosterById(rosterId)
  if (!roster) return null
  const rosterShifts = getRosterShifts(rosterId)
  const insert = db.prepare(
    `INSERT OR IGNORE INTO shifts (id,userId,startTime,endTime,location,shiftType,status,duty)
     VALUES (?,?,?,?,?,?,'Scheduled',?)`
  )
  const publish = db.transaction(() => {
    for (const rs of rosterShifts) {
      const newId = `shft-p${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
      insert.run(newId, rs.userId, rs.startTime, rs.endTime, rs.location, rs.shiftType, rs.duty)
    }
    db.prepare(`UPDATE rosters SET status = 'Published' WHERE id = ?`).run(rosterId)
  })
  publish()
  return findRosterById(rosterId)
}

export function deleteRoster(id) {
  db.prepare('DELETE FROM roster_shifts WHERE rosterId = ?').run(id)
  const { changes } = db.prepare('DELETE FROM rosters WHERE id = ?').run(id)
  return changes > 0
}
