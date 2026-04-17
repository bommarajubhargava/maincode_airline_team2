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

const { count } = db.prepare('SELECT COUNT(*) as count FROM shifts').get()
const { userCount } = db.prepare('SELECT COUNT(DISTINCT userId) as userCount FROM shifts').get()
if (count === 0 || userCount < 15) {
  db.exec('DELETE FROM shifts')
  const insert = db.prepare(
    'INSERT INTO shifts (id,userId,startTime,endTime,location,shiftType,status,duty) VALUES (?,?,?,?,?,?,?,?)'
  )
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insert.run(r.id, r.userId, r.startTime, r.endTime, r.location, r.shiftType, r.status, r.duty)
  })
  insertMany(generateShifts())
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
