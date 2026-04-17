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
`)

// ── Seed shifts if empty ──────────────────────────────────────────────────────

function generateShifts() {
  // 20 schedulable employees (Staff + Agent only, not managers/admin)
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

  // 3 non-overlapping shift slots (hours are 24h, 30 = 06:00 next day)
  const SLOTS = {
    Morning:   { start: 6,  end: 14 },
    Afternoon: { start: 14, end: 22 },
    Night:     { start: 22, end: 30 },
  }

  // All pairs are non-overlapping
  const PAIRS = [
    ['Morning', 'Afternoon'],
    ['Morning', 'Night'],
    ['Afternoon', 'Night'],
  ]

  let rng = 42
  const rand = (max) => { rng = ((rng * 1664525) + 1013904223) & 0x7fffffff; return rng % max }

  const today = new Date(); today.setHours(0,0,0,0)
  const shifts = []
  let counter = 1

  for (let day = -5; day < 30; day++) {
    const date    = new Date(today); date.setDate(today.getDate() + day)
    const dayIdx  = day + 5                          // 0-based (0–34)
    const isPast  = day < 0
    const isToday = day === 0

    // Round-robin 2 employees per day — no employee appears twice on same day
    const emp1Idx = (dayIdx * 2)     % staffIds.length
    const emp2Idx = (dayIdx * 2 + 1) % staffIds.length

    // Rotate through non-overlapping pairs
    const [type1, type2] = PAIRS[dayIdx % PAIRS.length]

    for (const [userId, shiftType] of [[staffIds[emp1Idx], type1], [staffIds[emp2Idx], type2]]) {
      const { start, end } = SLOTS[shiftType]
      const startTime = new Date(date); startTime.setHours(start, 0, 0, 0)
      const endTime   = new Date(date); endTime.setHours(end % 24, 0, 0, 0)
      if (end >= 24) endTime.setDate(endTime.getDate() + 1)

      // Past → realistic mix | Today → Scheduled | Future → Scheduled (20% Cancelled)
      const pastRoll = rand(10)
      const status = isPast
        ? pastRoll < 7 ? 'Completed' : pastRoll < 9 ? 'Cancelled' : 'Swapped'
        : isToday ? 'Scheduled'
        : rand(10) < 2 ? 'Cancelled' : 'Scheduled'

      shifts.push({
        id: `shft-${String(counter++).padStart(4,'0')}`,
        userId, shiftType, status,
        startTime: startTime.toISOString(),
        endTime:   endTime.toISOString(),
        location:  locations[rand(locations.length)],
      })
    }
  }

  return shifts
}

const { count } = db.prepare('SELECT COUNT(*) as count FROM shifts').get()
const { userCount } = db.prepare('SELECT COUNT(DISTINCT userId) as userCount FROM shifts').get()
if (count === 0 || userCount < 15) {
  db.exec('DELETE FROM shifts')
  const insert = db.prepare(
    'INSERT INTO shifts (id,userId,startTime,endTime,location,shiftType,status) VALUES (?,?,?,?,?,?,?)'
  )
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insert.run(r.id, r.userId, r.startTime, r.endTime, r.location, r.shiftType, r.status)
  })
  insertMany(generateShifts())
}

// ── Shifts ────────────────────────────────────────────────────────────────────

export const getShifts = () =>
  db.prepare('SELECT * FROM shifts ORDER BY startTime').all()

export const findShiftById = (id) =>
  db.prepare('SELECT * FROM shifts WHERE id = ?').get(id)

export function updateShift(id, updates) {
  const allowed = ['startTime','endTime','location','shiftType','status','userId']
  const fields  = Object.keys(updates).filter(k => allowed.includes(k))
  if (!fields.length) return findShiftById(id)
  const set = fields.map(k => `${k} = ?`).join(', ')
  db.prepare(`UPDATE shifts SET ${set} WHERE id = ?`).run(...fields.map(k => updates[k]), id)
  return findShiftById(id)
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

// ── Shifts by date (for colleagues view) ─────────────────────────────────────

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
