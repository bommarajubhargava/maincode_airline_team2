import { createClient } from '@libsql/client/web'
import bcrypt from 'bcryptjs'

const client = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

// ── Init ──────────────────────────────────────────────────────────────────────

let _ready = null
function ready() {
  if (!_ready) _ready = initDb().catch(err => { _ready = null; throw err })
  return _ready
}

async function initDb() {
  console.log('[initDb] starting')
  await client.batch([
    `CREATE TABLE IF NOT EXISTS seed_version (version INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE
      )`,
    `CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL, role_id TEXT NOT NULL,
        employee_id TEXT NOT NULL UNIQUE, designation TEXT NOT NULL,
        department TEXT NOT NULL, dob TEXT, date_of_joining TEXT,
        gender TEXT NOT NULL DEFAULT 'Unspecified'
      )`,
    `CREATE TABLE IF NOT EXISTS airports (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, country TEXT NOT NULL, state TEXT NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS shift_types (
        id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE,
        start_hour INTEGER NOT NULL, end_hour INTEGER NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS shifts (
        id TEXT PRIMARY KEY, userId TEXT NOT NULL, startTime TEXT NOT NULL,
        endTime TEXT NOT NULL, location TEXT NOT NULL, shiftType TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Scheduled', duty TEXT NOT NULL DEFAULT 'General'
      )`,
    `CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY, requestingUserId TEXT NOT NULL, targetUserId TEXT,
        shiftId TEXT NOT NULL, targetShiftId TEXT, requestType TEXT NOT NULL,
        reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Pending',
        managerComment TEXT, createdAt TEXT NOT NULL,
        proposedStartTime TEXT, proposedEndTime TEXT
      )`,
    `CREATE TABLE IF NOT EXISTS catering_logs (
        id TEXT PRIMARY KEY, flightId TEXT NOT NULL, agentId TEXT NOT NULL,
        loadedAt TEXT NOT NULL, itemsJson TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Loaded'
      )`,
    `CREATE TABLE IF NOT EXISTS cleanup_logs (
        id TEXT PRIMARY KEY, flightId TEXT NOT NULL, agentId TEXT NOT NULL,
        completedAt TEXT NOT NULL, tasksJson TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Completed'
      )`,
    `CREATE TABLE IF NOT EXISTS flights (
        id TEXT PRIMARY KEY, flight_number TEXT NOT NULL,
        from_airport TEXT NOT NULL, to_airport TEXT NOT NULL,
        scheduled_time TEXT NOT NULL, flight_type TEXT NOT NULL DEFAULT 'Departing',
        aircraft TEXT NOT NULL, passenger_count INTEGER NOT NULL DEFAULT 100,
        status TEXT NOT NULL DEFAULT 'Scheduled'
      )`,
    `CREATE TABLE IF NOT EXISTS flight_duty_logs (
        id TEXT PRIMARY KEY, flight_id TEXT NOT NULL,
        duty_key TEXT NOT NULL, completed_by TEXT NOT NULL,
        completed_at TEXT NOT NULL, form_data TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'Completed'
      )`,
  ], 'write')
  console.log('[initDb] tables created')

  // Schema migrations
  try { await client.execute("ALTER TABLE employees ADD COLUMN airport_id TEXT") } catch {}
  try { await client.execute("ALTER TABLE flights ADD COLUMN completion_notes TEXT") } catch {}
  try { await client.execute("ALTER TABLE flights ADD COLUMN completed_at TEXT") } catch {}
  try { await client.execute("ALTER TABLE flights ADD COLUMN airport_id TEXT") } catch {}
  console.log('[initDb] migrations done')

  // Check seed version — reseed if outdated
  const { rows: vRows } = await client.execute('SELECT version FROM seed_version LIMIT 1')
  const currentVersion = Number(vRows[0]?.version ?? 0)
  console.log('[initDb] seed version:', currentVersion)

  if (currentVersion < 2) {
    console.log('[initDb] running v2 reseed...')
    await wipeAndReseed()
    console.log('[initDb] reseed complete')
  }

  console.log('[initDb] done')
}

async function wipeAndReseed() {
  await client.batch([
    'DELETE FROM flight_duty_logs',
    'DELETE FROM flights',
    'DELETE FROM shifts',
    'DELETE FROM requests',
    'DELETE FROM catering_logs',
    'DELETE FROM cleanup_logs',
    'DELETE FROM employees',
    'DELETE FROM airports',
    'DELETE FROM shift_types',
    'DELETE FROM roles',
    'DELETE FROM seed_version',
  ], 'write')

  await seedReferenceData()
  await seedShifts()
  await seedFlights()

  await client.execute({ sql: 'INSERT INTO seed_version (version) VALUES (?)', args: [2] })
}

// ── Seed Reference Data ───────────────────────────────────────────────────────

async function seedReferenceData() {
  // Roles
  await client.batch([
    `INSERT INTO roles (id, name) VALUES ('role-staff',   'Staff')`,
    `INSERT INTO roles (id, name) VALUES ('role-agent',   'Agent')`,
    `INSERT INTO roles (id, name) VALUES ('role-manager', 'Manager')`,
    `INSERT INTO roles (id, name) VALUES ('role-admin',   'Admin')`,
  ], 'write')

  // Shift types
  await client.batch([
    `INSERT INTO shift_types (id, name, start_hour, end_hour) VALUES ('st-morning',   'Morning',   6,  14)`,
    `INSERT INTO shift_types (id, name, start_hour, end_hour) VALUES ('st-afternoon', 'Afternoon', 14, 22)`,
    `INSERT INTO shift_types (id, name, start_hour, end_hour) VALUES ('st-night',     'Night',     22,  6)`,
  ], 'write')

  // Airports — 3 home airports + common destinations
  await client.batch([
    `INSERT INTO airports (id, name, country, state) VALUES ('YYZ', 'Toronto Pearson International', 'Canada', 'Ontario')`,
    `INSERT INTO airports (id, name, country, state) VALUES ('YTZ', 'Billy Bishop Toronto City',     'Canada', 'Ontario')`,
    `INSERT INTO airports (id, name, country, state) VALUES ('YHM', 'John C. Munro Hamilton',        'Canada', 'Ontario')`,
    `INSERT INTO airports (id, name, country, state) VALUES ('JFK', 'John F. Kennedy International', 'USA',    'New York')`,
    `INSERT INTO airports (id, name, country, state) VALUES ('ORD', 'OHare International',           'USA',    'Illinois')`,
    `INSERT INTO airports (id, name, country, state) VALUES ('LHR', 'London Heathrow',               'UK',     'England')`,
    `INSERT INTO airports (id, name, country, state) VALUES ('LAX', 'Los Angeles International',     'USA',    'California')`,
    `INSERT INTO airports (id, name, country, state) VALUES ('MIA', 'Miami International',           'USA',    'Florida')`,
    `INSERT INTO airports (id, name, country, state) VALUES ('YOW', 'Ottawa Macdonald-Cartier',      'Canada', 'Ontario')`,
    `INSERT INTO airports (id, name, country, state) VALUES ('YUL', 'Montreal-Trudeau',              'Canada', 'Quebec')`,
    `INSERT INTO airports (id, name, country, state) VALUES ('YHZ', 'Halifax Stanfield',             'Canada', 'Nova Scotia')`,
    `INSERT INTO airports (id, name, country, state) VALUES ('YYC', 'Calgary International',         'Canada', 'Alberta')`,
    `INSERT INTO airports (id, name, country, state) VALUES ('YEG', 'Edmonton International',        'Canada', 'Alberta')`,
    `INSERT INTO airports (id, name, country, state) VALUES ('YVR', 'Vancouver International',       'Canada', 'BC')`,
    `INSERT INTO airports (id, name, country, state) VALUES ('YWG', 'Winnipeg Richardson',           'Canada', 'Manitoba')`,
  ], 'write')

  // Employees — password '1234'
  const hash = await bcrypt.hash('1234', 10)

  const employees = [
    // Admin (no specific airport)
    { id: 'emp-admin',    name: 'Alex Admin',      email: 'admin@skystaff.com',          role: 'role-admin',   empId: 'ADMIN-001', designation: 'System Administrator',      dept: 'IT',                  dob: '1985-06-15', doj: '2010-01-01', airport: null   },
    // YYZ — 3 agents: Morning / Afternoon / Evening, each covers all duties for their shift
    { id: 'emp-yyz-mgr',  name: 'Sarah Mitchell',  email: 'manager.yyz@skystaff.com',    role: 'role-manager', empId: 'YYZ-MGR-01', designation: 'Airport Operations Manager',    dept: 'Airport Operations', dob: '1980-03-22', doj: '2012-05-01', airport: 'YYZ' },
    { id: 'emp-yyz-a1',   name: 'Tom Reid',         email: 'agent1.yyz@skystaff.com',     role: 'role-agent',   empId: 'YYZ-AGT-01', designation: 'Morning Operations Agent',      dept: 'Ground Services',    dob: '1992-07-10', doj: '2018-03-15', airport: 'YYZ' },
    { id: 'emp-yyz-a2',   name: 'Lisa Park',        email: 'agent2.yyz@skystaff.com',     role: 'role-agent',   empId: 'YYZ-AGT-02', designation: 'Afternoon Operations Agent',    dept: 'Ground Services',    dob: '1994-11-28', doj: '2019-08-01', airport: 'YYZ' },
    { id: 'emp-yyz-a3',   name: 'Carlos Reyes',     email: 'agent3.yyz@skystaff.com',     role: 'role-agent',   empId: 'YYZ-AGT-03', designation: 'Evening Operations Agent',      dept: 'Ground Services',    dob: '1990-04-05', doj: '2017-06-01', airport: 'YYZ' },
    // YTZ
    { id: 'emp-ytz-mgr',  name: 'James O Brien',    email: 'manager.ytz@skystaff.com',    role: 'role-manager', empId: 'YTZ-MGR-01', designation: 'Airport Operations Manager',    dept: 'Airport Operations', dob: '1978-12-01', doj: '2011-09-01', airport: 'YTZ' },
    { id: 'emp-ytz-a1',   name: 'Nina Patel',       email: 'agent1.ytz@skystaff.com',     role: 'role-agent',   empId: 'YTZ-AGT-01', designation: 'Morning Operations Agent',      dept: 'Ground Services',    dob: '1993-02-17', doj: '2018-11-01', airport: 'YTZ' },
    { id: 'emp-ytz-a2',   name: 'Marcus Hill',      email: 'agent2.ytz@skystaff.com',     role: 'role-agent',   empId: 'YTZ-AGT-02', designation: 'Afternoon Operations Agent',    dept: 'Ground Services',    dob: '1991-08-30', doj: '2019-04-15', airport: 'YTZ' },
    { id: 'emp-ytz-a3',   name: 'Rosa Kim',         email: 'agent3.ytz@skystaff.com',     role: 'role-agent',   empId: 'YTZ-AGT-03', designation: 'Evening Operations Agent',      dept: 'Ground Services',    dob: '1995-05-22', doj: '2020-02-01', airport: 'YTZ' },
    // YHM
    { id: 'emp-yhm-mgr',  name: 'Patricia Blake',   email: 'manager.yhm@skystaff.com',    role: 'role-manager', empId: 'YHM-MGR-01', designation: 'Airport Operations Manager',    dept: 'Airport Operations', dob: '1982-10-14', doj: '2013-07-01', airport: 'YHM' },
    { id: 'emp-yhm-a1',   name: 'Eric Taylor',      email: 'agent1.yhm@skystaff.com',     role: 'role-agent',   empId: 'YHM-AGT-01', designation: 'Morning Operations Agent',      dept: 'Ground Services',    dob: '1989-06-03', doj: '2016-10-01', airport: 'YHM' },
    { id: 'emp-yhm-a2',   name: 'Sophie Brown',     email: 'agent2.yhm@skystaff.com',     role: 'role-agent',   empId: 'YHM-AGT-02', designation: 'Afternoon Operations Agent',    dept: 'Ground Services',    dob: '1998-03-25', doj: '2022-09-01', airport: 'YHM' },
    { id: 'emp-yhm-a3',   name: 'Amir Hassan',      email: 'agent3.yhm@skystaff.com',     role: 'role-agent',   empId: 'YHM-AGT-03', designation: 'Evening Operations Agent',      dept: 'Ground Services',    dob: '1988-11-18', doj: '2015-04-01', airport: 'YHM' },
  ]

  const CHUNK = 10
  for (let i = 0; i < employees.length; i += CHUNK) {
    await client.batch(
      employees.slice(i, i + CHUNK).map(e => ({
        sql: `INSERT INTO employees (id,name,email,password_hash,role_id,employee_id,designation,department,dob,date_of_joining,gender,airport_id)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [e.id, e.name, e.email, hash, e.role, e.empId, e.designation, e.dept, e.dob, e.doj, 'Unspecified', e.airport],
      })),
      'write'
    )
  }
}

// ── Seed Shifts (next 10 days) ────────────────────────────────────────────────
// 3 agents per airport, each covering ALL duty types for their time slot:
//   Agent 1 (Morning):   06:00–14:00 → General + Catering + Cleanup
//   Agent 2 (Afternoon): 14:00–22:00 → General + Catering + Cleanup
//   Agent 3 (Evening):   22:00–06:00 → General + Catering + Cleanup
// Flights are matched to the responsible agent by shift time overlap.

async function seedShifts() {
  const airports = [
    { code: 'YYZ', a1: 'emp-yyz-a1', a2: 'emp-yyz-a2', a3: 'emp-yyz-a3' },
    { code: 'YTZ', a1: 'emp-ytz-a1', a2: 'emp-ytz-a2', a3: 'emp-ytz-a3' },
    { code: 'YHM', a1: 'emp-yhm-a1', a2: 'emp-yhm-a2', a3: 'emp-yhm-a3' },
  ]
  const DUTIES = ['General', 'Catering', 'Cleanup']

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const stmts = []
  let counter = 1

  for (const ap of airports) {
    for (let offset = 0; offset < 10; offset++) {
      const d = new Date(today); d.setDate(today.getDate() + offset)
      const ds = d.toISOString().slice(0, 10)

      // Morning agent: 06:00–14:00
      for (const duty of DUTIES) {
        stmts.push({ sql: 'INSERT INTO shifts (id,userId,startTime,endTime,location,shiftType,status,duty) VALUES (?,?,?,?,?,?,?,?)',
          args: [`shft-${String(counter++).padStart(4,'0')}`, ap.a1,
            `${ds}T06:00:00.000Z`, `${ds}T14:00:00.000Z`, ap.code, 'Morning', 'Scheduled', duty] })
      }

      // Afternoon agent: 14:00–22:00
      for (const duty of DUTIES) {
        stmts.push({ sql: 'INSERT INTO shifts (id,userId,startTime,endTime,location,shiftType,status,duty) VALUES (?,?,?,?,?,?,?,?)',
          args: [`shft-${String(counter++).padStart(4,'0')}`, ap.a2,
            `${ds}T14:00:00.000Z`, `${ds}T22:00:00.000Z`, ap.code, 'Afternoon', 'Scheduled', duty] })
      }

      // Evening agent: 22:00–06:00 next day
      const nextDs = new Date(d); nextDs.setDate(d.getDate() + 1)
      const nextDsStr = nextDs.toISOString().slice(0, 10)
      for (const duty of DUTIES) {
        stmts.push({ sql: 'INSERT INTO shifts (id,userId,startTime,endTime,location,shiftType,status,duty) VALUES (?,?,?,?,?,?,?,?)',
          args: [`shft-${String(counter++).padStart(4,'0')}`, ap.a3,
            `${ds}T22:00:00.000Z`, `${nextDsStr}T06:00:00.000Z`, ap.code, 'Night', 'Scheduled', duty] })
      }
    }
  }

  const CHUNK = 50
  for (let i = 0; i < stmts.length; i += CHUNK) {
    await client.batch(stmts.slice(i, i + CHUNK), 'write')
  }
}

// ── Seed Flights (5 days × 1 dep + 1 arr per airport = 10 flights/airport) ───

async function seedFlights() {
  const today = new Date(); today.setHours(0, 0, 0, 0)

  function atTime(offset, hh, mm = 0) {
    const d = new Date(today)
    d.setDate(today.getDate() + offset)
    d.setUTCHours(hh, mm, 0, 0)
    return d.toISOString()
  }

  const flights = [
    // YYZ — Air Canada
    { id:'flt-yyz-d1', num:'AC101', from:'YYZ', to:'JFK', time:atTime(0,13,30), type:'Departing', aircraft:'Boeing 737-800',   pax:168, apt:'YYZ' },
    { id:'flt-yyz-a1', num:'AC102', from:'JFK', to:'YYZ', time:atTime(0,20,15), type:'Arriving',  aircraft:'Boeing 737-800',   pax:162, apt:'YYZ' },
    { id:'flt-yyz-d2', num:'AC203', from:'YYZ', to:'ORD', time:atTime(1,8,0),   type:'Departing', aircraft:'Airbus A320neo',   pax:156, apt:'YYZ' },
    { id:'flt-yyz-a2', num:'AC204', from:'ORD', to:'YYZ', time:atTime(1,15,45), type:'Arriving',  aircraft:'Airbus A320neo',   pax:150, apt:'YYZ' },
    { id:'flt-yyz-d3', num:'AC305', from:'YYZ', to:'LHR', time:atTime(2,22,0),  type:'Departing', aircraft:'Boeing 787-9',     pax:290, apt:'YYZ' },
    { id:'flt-yyz-a3', num:'AC306', from:'LHR', to:'YYZ', time:atTime(3,14,30), type:'Arriving',  aircraft:'Boeing 787-9',     pax:285, apt:'YYZ' },
    { id:'flt-yyz-d4', num:'AC407', from:'YYZ', to:'LAX', time:atTime(3,11,0),  type:'Departing', aircraft:'Airbus A321',      pax:185, apt:'YYZ' },
    { id:'flt-yyz-a4', num:'AC408', from:'LAX', to:'YYZ', time:atTime(3,23,0),  type:'Arriving',  aircraft:'Airbus A321',      pax:180, apt:'YYZ' },
    { id:'flt-yyz-d5', num:'AC509', from:'YYZ', to:'MIA', time:atTime(4,9,30),  type:'Departing', aircraft:'Boeing 737 MAX 8', pax:172, apt:'YYZ' },
    { id:'flt-yyz-a5', num:'AC510', from:'MIA', to:'YYZ', time:atTime(4,16,0),  type:'Arriving',  aircraft:'Boeing 737 MAX 8', pax:170, apt:'YYZ' },

    // YTZ — Porter Airlines
    { id:'flt-ytz-d1', num:'PD101', from:'YTZ', to:'YOW', time:atTime(0,12,0),  type:'Departing', aircraft:'De Havilland Q400', pax:70, apt:'YTZ' },
    { id:'flt-ytz-a1', num:'PD102', from:'YOW', to:'YTZ', time:atTime(0,14,30), type:'Arriving',  aircraft:'De Havilland Q400', pax:68, apt:'YTZ' },
    { id:'flt-ytz-d2', num:'PD203', from:'YTZ', to:'YUL', time:atTime(1,7,30),  type:'Departing', aircraft:'Embraer E195-E2',  pax:110, apt:'YTZ' },
    { id:'flt-ytz-a2', num:'PD204', from:'YUL', to:'YTZ', time:atTime(1,13,0),  type:'Arriving',  aircraft:'Embraer E195-E2',  pax:108, apt:'YTZ' },
    { id:'flt-ytz-d3', num:'PD305', from:'YTZ', to:'YHZ', time:atTime(2,9,0),   type:'Departing', aircraft:'De Havilland Q400', pax:72, apt:'YTZ' },
    { id:'flt-ytz-a3', num:'PD306', from:'YHZ', to:'YTZ', time:atTime(2,16,15), type:'Arriving',  aircraft:'De Havilland Q400', pax:70, apt:'YTZ' },
    { id:'flt-ytz-d4', num:'PD407', from:'YTZ', to:'YYC', time:atTime(3,6,45),  type:'Departing', aircraft:'Embraer E195-E2',  pax:112, apt:'YTZ' },
    { id:'flt-ytz-a4', num:'PD408', from:'YYC', to:'YTZ', time:atTime(3,19,30), type:'Arriving',  aircraft:'Embraer E195-E2',  pax:109, apt:'YTZ' },
    { id:'flt-ytz-d5', num:'PD509', from:'YTZ', to:'YEG', time:atTime(4,10,15), type:'Departing', aircraft:'De Havilland Q400', pax:74, apt:'YTZ' },
    { id:'flt-ytz-a5', num:'PD510', from:'YEG', to:'YTZ', time:atTime(4,17,45), type:'Arriving',  aircraft:'De Havilland Q400', pax:72, apt:'YTZ' },

    // YHM — Swoop / Charter
    { id:'flt-yhm-d1', num:'SW101', from:'YHM', to:'YYZ', time:atTime(0,11,0),  type:'Departing', aircraft:'Boeing 737-800',   pax:148, apt:'YHM' },
    { id:'flt-yhm-a1', num:'SW102', from:'YYZ', to:'YHM', time:atTime(0,18,30), type:'Arriving',  aircraft:'Boeing 737-800',   pax:145, apt:'YHM' },
    { id:'flt-yhm-d2', num:'SW203', from:'YHM', to:'YUL', time:atTime(1,8,45),  type:'Departing', aircraft:'Airbus A320',      pax:160, apt:'YHM' },
    { id:'flt-yhm-a2', num:'SW204', from:'YUL', to:'YHM', time:atTime(1,16,0),  type:'Arriving',  aircraft:'Airbus A320',      pax:158, apt:'YHM' },
    { id:'flt-yhm-d3', num:'SW305', from:'YHM', to:'YVR', time:atTime(2,7,0),   type:'Departing', aircraft:'Boeing 737 MAX 8', pax:175, apt:'YHM' },
    { id:'flt-yhm-a3', num:'SW306', from:'YVR', to:'YHM', time:atTime(2,21,15), type:'Arriving',  aircraft:'Boeing 737 MAX 8', pax:172, apt:'YHM' },
    { id:'flt-yhm-d4', num:'SW407', from:'YHM', to:'YOW', time:atTime(3,9,30),  type:'Departing', aircraft:'Airbus A319',      pax:132, apt:'YHM' },
    { id:'flt-yhm-a4', num:'SW408', from:'YOW', to:'YHM', time:atTime(3,15,45), type:'Arriving',  aircraft:'Airbus A319',      pax:130, apt:'YHM' },
    { id:'flt-yhm-d5', num:'SW509', from:'YHM', to:'YWG', time:atTime(4,12,0),  type:'Departing', aircraft:'Boeing 737-800',   pax:152, apt:'YHM' },
    { id:'flt-yhm-a5', num:'SW510', from:'YWG', to:'YHM', time:atTime(4,19,0),  type:'Arriving',  aircraft:'Boeing 737-800',   pax:150, apt:'YHM' },
  ]

  await client.batch(
    flights.map(f => ({
      sql: 'INSERT INTO flights (id,flight_number,from_airport,to_airport,scheduled_time,flight_type,aircraft,passenger_count,airport_id) VALUES (?,?,?,?,?,?,?,?,?)',
      args: [f.id, f.num, f.from, f.to, f.time, f.type, f.aircraft, f.pax, f.apt],
    })),
    'write'
  )
}

// ── Employees ─────────────────────────────────────────────────────────────────

export async function getEmployees() {
  await ready()
  const { rows } = await client.execute(`
    SELECT e.*, r.name as role, a.name as airport_name
    FROM employees e
    JOIN roles r ON e.role_id = r.id
    LEFT JOIN airports a ON e.airport_id = a.id
    ORDER BY e.name
  `)
  return rows
}

export async function findEmployeeByEmail(email) {
  await ready()
  const { rows } = await client.execute({
    sql: `SELECT e.*, r.name as role, a.name as airport_name
          FROM employees e
          JOIN roles r ON e.role_id = r.id
          LEFT JOIN airports a ON e.airport_id = a.id
          WHERE LOWER(e.email) = LOWER(?)`,
    args: [email],
  })
  return rows[0] ?? null
}

export async function findEmployeeById(id) {
  await ready()
  const { rows } = await client.execute({
    sql: `SELECT e.*, r.name as role, a.name as airport_name
          FROM employees e
          JOIN roles r ON e.role_id = r.id
          LEFT JOIN airports a ON e.airport_id = a.id
          WHERE e.id = ?`,
    args: [id],
  })
  return rows[0] ?? null
}

export function safeEmployee(e) {
  return {
    id: e.id, name: e.name, email: e.email, role: e.role,
    employeeId: e.employee_id, department: e.department,
    designation: e.designation, dob: e.dob,
    dateOfJoining: e.date_of_joining, gender: e.gender,
    airportId: e.airport_id ?? null,
    airportName: e.airport_name ?? null,
  }
}

// ── Reference Data ────────────────────────────────────────────────────────────

export async function getRoles() {
  await ready()
  const { rows } = await client.execute('SELECT * FROM roles ORDER BY name')
  return rows
}

export async function getAirports() {
  await ready()
  const { rows } = await client.execute('SELECT * FROM airports ORDER BY name')
  return rows
}

export async function getShiftTypes() {
  await ready()
  const { rows } = await client.execute('SELECT * FROM shift_types ORDER BY start_hour')
  return rows
}

// ── Shifts ────────────────────────────────────────────────────────────────────

export async function getShifts() {
  await ready()
  const { rows } = await client.execute('SELECT * FROM shifts ORDER BY startTime')
  return rows
}

export async function findShiftById(id) {
  await ready()
  const { rows } = await client.execute({ sql: 'SELECT * FROM shifts WHERE id = ?', args: [id] })
  return rows[0] ?? null
}

export async function updateShift(id, updates) {
  await ready()
  const allowed = ['startTime','endTime','location','shiftType','status','userId','duty']
  const fields  = Object.keys(updates).filter(k => allowed.includes(k))
  if (!fields.length) return findShiftById(id)
  const set = fields.map(k => `${k} = ?`).join(', ')
  await client.execute({ sql: `UPDATE shifts SET ${set} WHERE id = ?`, args: [...fields.map(k => updates[k]), id] })
  return findShiftById(id)
}

export async function getTodayDuties(userId) {
  await ready()
  const { rows } = await client.execute({
    sql:  "SELECT duty FROM shifts WHERE userId = ? AND date(startTime) = date('now')",
    args: [userId],
  })
  return rows.map(r => r.duty)
}

export async function getShiftsByDate(dateStr) {
  await ready()
  const { rows } = await client.execute({
    sql:  'SELECT * FROM shifts WHERE date(startTime) = ? ORDER BY startTime',
    args: [dateStr],
  })
  return rows
}

export async function assignShifts({ employeeIds, shiftTypeId, dates, airportId, duty }) {
  await ready()
  const { rows: stRows } = await client.execute({ sql: 'SELECT * FROM shift_types WHERE id = ?', args: [shiftTypeId] })
  const shiftType = stRows[0]
  if (!shiftType) throw new Error('Invalid shift type')

  const { rows: maxRows } = await client.execute(
    "SELECT COALESCE(MAX(CAST(REPLACE(id,'shft-','') AS INTEGER)),0) as m FROM shifts"
  )
  let counter = Number(maxRows[0].m) + 1

  const stmts = []
  for (const empId of employeeIds) {
    for (const dateStr of dates) {
      const [y, m, d]  = dateStr.split('-').map(Number)
      const startTime  = new Date(y, m - 1, d, shiftType.start_hour, 0, 0, 0)
      const endTime    = new Date(y, m - 1, d, shiftType.end_hour,   0, 0, 0)
      if (shiftType.end_hour < shiftType.start_hour) endTime.setDate(endTime.getDate() + 1)
      const resolvedDuty = duty || 'General'
      stmts.push({
        sql:  'INSERT INTO shifts (id,userId,startTime,endTime,location,shiftType,status,duty) VALUES (?,?,?,?,?,?,?,?)',
        args: [
          `shft-${String(counter++).padStart(4, '0')}`,
          empId, startTime.toISOString(), endTime.toISOString(),
          airportId || 'YYZ', shiftType.name, 'Scheduled', resolvedDuty,
        ],
      })
    }
  }

  const CHUNK = 50
  for (let i = 0; i < stmts.length; i += CHUNK) {
    await client.batch(stmts.slice(i, i + CHUNK), 'write')
  }
  return { assigned: stmts.length }
}

// ── Flights ───────────────────────────────────────────────────────────────────

export async function getFlights({ type, today, date, flightNumber, airportId } = {}) {
  await ready()
  let sql = 'SELECT * FROM flights'
  const args = []
  const where = []
  if (airportId)     { where.push('airport_id = ?');                         args.push(airportId) }
  if (type)          { where.push('flight_type = ?');                        args.push(type) }
  if (today)         { where.push("date(scheduled_time) = date('now')") }
  if (date)          { where.push('date(scheduled_time) = ?');               args.push(date) }
  if (flightNumber)  { where.push('UPPER(flight_number) LIKE UPPER(?)');     args.push(`%${flightNumber}%`) }
  if (where.length)  sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY scheduled_time'
  const { rows } = await client.execute(args.length ? { sql, args } : sql)
  return rows
}

export async function findFlightRecordById(id) {
  await ready()
  const { rows } = await client.execute({ sql: 'SELECT * FROM flights WHERE id = ?', args: [id] })
  return rows[0] ?? null
}

export async function updateFlightStatus(flightId, { status, completionNotes = null }) {
  await ready()
  await client.execute({
    sql: 'UPDATE flights SET status = ?, completion_notes = ?, completed_at = ? WHERE id = ?',
    args: [status, completionNotes, status === 'Completed' ? new Date().toISOString() : null, flightId],
  })
  return findFlightRecordById(flightId)
}

// ── Flight Duties ─────────────────────────────────────────────────────────────

export async function getFlightDutyLogs(flightId) {
  await ready()
  const { rows } = await client.execute({
    sql: 'SELECT * FROM flight_duty_logs WHERE flight_id = ? ORDER BY completed_at DESC',
    args: [flightId],
  })
  return rows.map(r => ({ ...r, form_data: JSON.parse(r.form_data || '{}') }))
}

export async function submitFlightDuty({ flightId, dutyKey, completedBy, formData }) {
  await ready()
  await client.execute({
    sql: 'DELETE FROM flight_duty_logs WHERE flight_id = ? AND duty_key = ?',
    args: [flightId, dutyKey],
  })
  const id = `fdl-${Date.now()}`
  await client.execute({
    sql: 'INSERT INTO flight_duty_logs (id,flight_id,duty_key,completed_by,completed_at,form_data,status) VALUES (?,?,?,?,?,?,?)',
    args: [id, flightId, dutyKey, completedBy, new Date().toISOString(), JSON.stringify(formData), 'Completed'],
  })
  return getFlightDutyLogs(flightId)
}

// flightTime (ISO string) narrows results to the agent whose shift covers that time
export async function getEmployeesByShiftDutyAndDate(date, shiftDuty, airportId, flightTime) {
  await ready()
  const args = [date, shiftDuty]
  const extras = []
  if (airportId)  { extras.push('e.airport_id = ?');         args.push(airportId) }
  if (flightTime) { extras.push('s.startTime <= ? AND s.endTime > ?'); args.push(flightTime, flightTime) }
  const where = extras.length ? 'AND ' + extras.join(' AND ') : ''
  const { rows } = await client.execute({
    sql: `SELECT DISTINCT e.id, e.name, e.email, e.employee_id
          FROM shifts s JOIN employees e ON s.userId = e.id
          WHERE date(s.startTime) = ? AND s.duty = ? AND s.status != 'Cancelled'
          ${where}
          ORDER BY e.name`,
    args,
  })
  return rows
}

export async function getUserShiftDutiesForDate(userId, date) {
  await ready()
  const { rows } = await client.execute({
    sql: `SELECT DISTINCT duty FROM shifts WHERE userId = ? AND date(startTime) = ? AND status != 'Cancelled'`,
    args: [userId, date],
  })
  return rows.map(r => r.duty)
}

// ── Admin Overview ────────────────────────────────────────────────────────────

export async function getAirportOverview(airportId, date) {
  await ready()
  const dateStr = date || new Date().toISOString().slice(0, 10)

  const { rows: flights } = await client.execute({
    sql: `SELECT * FROM flights WHERE airport_id = ? AND date(scheduled_time) = ? ORDER BY scheduled_time`,
    args: [airportId, dateStr],
  })

  // Duty completion counts per flight
  const dutyStats = {}
  if (flights.length > 0) {
    const ph = flights.map(() => '?').join(',')
    const { rows: logs } = await client.execute({
      sql: `SELECT flight_id, COUNT(*) as cnt FROM flight_duty_logs WHERE flight_id IN (${ph}) GROUP BY flight_id`,
      args: flights.map(f => f.id),
    })
    for (const l of logs) dutyStats[l.flight_id] = Number(l.cnt)
  }

  // Staff on shift today
  const { rows: staff } = await client.execute({
    sql: `SELECT e.id, e.name, e.email, e.employee_id, e.designation, s.duty, s.shiftType
          FROM shifts s JOIN employees e ON s.userId = e.id
          WHERE e.airport_id = ? AND date(s.startTime) = ? AND s.status != 'Cancelled'
          ORDER BY e.name`,
    args: [airportId, dateStr],
  })

  return {
    flights: flights.map(f => ({ ...f, completedDuties: dutyStats[f.id] ?? 0 })),
    staff,
  }
}

// ── Requests ──────────────────────────────────────────────────────────────────

export async function getRequests() {
  await ready()
  const { rows } = await client.execute('SELECT * FROM requests ORDER BY createdAt DESC')
  return rows
}

export async function findRequestById(id) {
  await ready()
  const { rows } = await client.execute({ sql: 'SELECT * FROM requests WHERE id = ?', args: [id] })
  return rows[0] ?? null
}

export async function addRequest(data) {
  await ready()
  const { rows } = await client.execute(
    "SELECT COALESCE(MAX(CAST(REPLACE(id,'req-','') AS INTEGER)),0) as c FROM requests"
  )
  const id        = `req-${String(Number(rows[0].c) + 1).padStart(4, '0')}`
  const createdAt = new Date().toISOString()
  await client.execute({
    sql: `INSERT INTO requests
      (id,requestingUserId,targetUserId,shiftId,targetShiftId,requestType,reason,status,managerComment,createdAt,proposedStartTime,proposedEndTime)
      VALUES (?,?,?,?,?,?,?,'Pending',NULL,?,?,?)`,
    args: [
      id, data.requestingUserId, data.targetUserId ?? null, data.shiftId,
      data.targetShiftId ?? null, data.requestType, data.reason, createdAt,
      data.proposedStartTime ?? null, data.proposedEndTime ?? null,
    ],
  })
  return findRequestById(id)
}

export async function updateRequest(id, updates) {
  await ready()
  const allowed = ['status','managerComment']
  const fields  = Object.keys(updates).filter(k => allowed.includes(k))
  if (!fields.length) return findRequestById(id)
  const set = fields.map(k => `${k} = ?`).join(', ')
  await client.execute({ sql: `UPDATE requests SET ${set} WHERE id = ?`, args: [...fields.map(k => updates[k]), id] })
  return findRequestById(id)
}

export async function deleteRequest(id) {
  await ready()
  const { rowsAffected } = await client.execute({ sql: 'DELETE FROM requests WHERE id = ?', args: [id] })
  return rowsAffected > 0
}

// ── Catering Logs ─────────────────────────────────────────────────────────────

export async function getCateringLog(flightId) {
  await ready()
  const { rows } = await client.execute({
    sql: 'SELECT * FROM catering_logs WHERE flightId = ? ORDER BY loadedAt DESC', args: [flightId],
  })
  return rows[0] ?? null
}

export async function addCateringLog(data) {
  await ready()
  const id = `cat-${Date.now()}`
  await client.execute({
    sql:  'INSERT INTO catering_logs (id,flightId,agentId,loadedAt,itemsJson,status) VALUES (?,?,?,?,?,?)',
    args: [id, data.flightId, data.agentId, new Date().toISOString(), JSON.stringify(data.items), 'Loaded'],
  })
  return getCateringLog(data.flightId)
}

// ── Admin: Shifts Overview ────────────────────────────────────────────────────

export async function getAdminShiftsOverview(date) {
  await ready()
  const { rows } = await client.execute({
    sql: `SELECT e.id, e.name, e.email, e.employee_id, e.designation,
                 e.airport_id, a.name as airport_name,
                 s.id as shift_id, s.shiftType, s.duty, s.status,
                 s.startTime, s.endTime
          FROM shifts s
          JOIN employees e ON s.userId = e.id
          LEFT JOIN airports a ON e.airport_id = a.id
          WHERE date(s.startTime) = ?
          ORDER BY e.airport_id, s.shiftType, e.name`,
    args: [date],
  })
  return rows
}

// ── Admin: Completion Report ──────────────────────────────────────────────────

export async function getCompletionReport(airportId, startDate, endDate) {
  await ready()

  const airportFilter = airportId ? 'AND f.airport_id = ?' : ''
  const args = airportId
    ? [startDate, endDate, airportId]
    : [startDate, endDate]

  const { rows: flights } = await client.execute({
    sql: `SELECT id, flight_type, status, airport_id, date(scheduled_time) as day
          FROM flights
          WHERE date(scheduled_time) >= ? AND date(scheduled_time) <= ?
          ${airportFilter}
          ORDER BY scheduled_time`,
    args,
  })

  if (!flights.length) return []

  const ph = flights.map(() => '?').join(',')
  const { rows: logs } = await client.execute({
    sql: `SELECT flight_id, COUNT(*) as cnt FROM flight_duty_logs WHERE flight_id IN (${ph}) GROUP BY flight_id`,
    args: flights.map(f => f.id),
  })
  const dutyMap = Object.fromEntries(logs.map(l => [l.flight_id, Number(l.cnt)]))

  // Group by airport + day
  const map = {}
  for (const f of flights) {
    const key = `${f.airport_id}|${f.day}`
    if (!map[key]) map[key] = { airport: f.airport_id, day: f.day, totalFlights: 0, completedFlights: 0, totalDuties: 0, completedDuties: 0 }
    const d = map[key]
    d.totalFlights++
    if (f.status === 'Completed') d.completedFlights++
    d.totalDuties    += f.flight_type === 'Departing' ? 7 : 6
    d.completedDuties += dutyMap[f.id] ?? 0
  }

  return Object.values(map).map(r => ({
    ...r,
    dutyCompletionPct:   r.totalDuties   > 0 ? Math.round((r.completedDuties   / r.totalDuties)   * 100) : 0,
    flightCompletionPct: r.totalFlights  > 0 ? Math.round((r.completedFlights  / r.totalFlights)  * 100) : 0,
  }))
}

// ── Admin: Attendance Report ──────────────────────────────────────────────────

export async function getAttendanceReport(airportId, startDate, endDate) {
  await ready()
  const airportFilter = airportId ? 'AND e.airport_id = ?' : ''
  const args = airportId ? [startDate, endDate, airportId] : [startDate, endDate]
  const { rows } = await client.execute({
    sql: `SELECT e.name, e.employee_id, e.airport_id, r.name as role, a.name as airport_name,
                 COUNT(*) as total_shifts,
                 COUNT(CASE WHEN s.status = 'Completed' THEN 1 END) as completed,
                 COUNT(CASE WHEN s.status = 'Scheduled' THEN 1 END) as scheduled,
                 COUNT(CASE WHEN s.status = 'Cancelled' THEN 1 END) as cancelled,
                 ROUND(SUM((julianday(s.endTime) - julianday(s.startTime)) * 24), 1) as total_hours
          FROM shifts s
          JOIN employees e ON s.userId = e.id
          JOIN roles r ON e.role_id = r.id
          LEFT JOIN airports a ON e.airport_id = a.id
          WHERE date(s.startTime) >= ? AND date(s.startTime) <= ?
            AND r.name IN ('Staff','Agent')
            ${airportFilter}
          GROUP BY e.id
          ORDER BY e.airport_id, e.name`,
    args,
  })
  return rows.map(r => ({
    name: r.name, employeeId: r.employee_id, role: r.role,
    airportId: r.airport_id, airportName: r.airport_name,
    totalShifts: Number(r.total_shifts), completed: Number(r.completed),
    scheduled: Number(r.scheduled), cancelled: Number(r.cancelled),
    totalHours: Number(r.total_hours ?? 0),
    attendancePct: r.total_shifts > 0 ? Math.round((Number(r.completed) / Number(r.total_shifts)) * 100) : 0,
  }))
}

// ── Admin: Duty Performance Report ────────────────────────────────────────────

export async function getDutyPerformanceReport(airportId, startDate, endDate) {
  await ready()
  const airportFilter = airportId ? 'AND e.airport_id = ?' : ''
  const args = airportId ? [startDate, endDate, airportId] : [startDate, endDate]
  const { rows } = await client.execute({
    sql: `SELECT s.duty, e.airport_id, a.name as airport_name,
                 COUNT(*) as total_shifts,
                 COUNT(CASE WHEN s.status = 'Completed' THEN 1 END) as completed,
                 COUNT(CASE WHEN s.status = 'Scheduled' THEN 1 END) as scheduled,
                 COUNT(CASE WHEN s.status = 'Cancelled' THEN 1 END) as cancelled
          FROM shifts s
          JOIN employees e ON s.userId = e.id
          JOIN roles r ON e.role_id = r.id
          LEFT JOIN airports a ON e.airport_id = a.id
          WHERE date(s.startTime) >= ? AND date(s.startTime) <= ?
            AND r.name IN ('Staff','Agent')
            ${airportFilter}
          GROUP BY s.duty, e.airport_id
          ORDER BY e.airport_id, s.duty`,
    args,
  })
  return rows.map(r => ({
    duty: r.duty, airportId: r.airport_id, airportName: r.airport_name,
    totalShifts: Number(r.total_shifts), completed: Number(r.completed),
    scheduled: Number(r.scheduled), cancelled: Number(r.cancelled),
    completionPct: r.total_shifts > 0 ? Math.round((Number(r.completed) / Number(r.total_shifts)) * 100) : 0,
  }))
}

// ── Admin: Staff Utilization Report ──────────────────────────────────────────

export async function getStaffUtilizationReport(airportId, startDate, endDate) {
  await ready()
  const airportFilter = airportId ? 'AND e.airport_id = ?' : ''
  const args = airportId ? [startDate, endDate, airportId] : [startDate, endDate]
  const { rows } = await client.execute({
    sql: `SELECT e.name, e.employee_id, e.airport_id, r.name as role, a.name as airport_name,
                 s.shiftType,
                 COUNT(*) as shift_count,
                 ROUND(SUM((julianday(s.endTime) - julianday(s.startTime)) * 24), 1) as hours
          FROM shifts s
          JOIN employees e ON s.userId = e.id
          JOIN roles r ON e.role_id = r.id
          LEFT JOIN airports a ON e.airport_id = a.id
          WHERE date(s.startTime) >= ? AND date(s.startTime) <= ?
            AND r.name IN ('Staff','Agent')
            ${airportFilter}
          GROUP BY e.id, s.shiftType
          ORDER BY e.airport_id, e.name, s.shiftType`,
    args,
  })
  // Group by employee
  const empMap = {}
  for (const r of rows) {
    if (!empMap[r.employee_id]) {
      empMap[r.employee_id] = {
        name: r.name, employeeId: r.employee_id, role: r.role,
        airportId: r.airport_id, airportName: r.airport_name,
        totalShifts: 0, totalHours: 0, breakdown: [],
      }
    }
    const e = empMap[r.employee_id]
    e.totalShifts += Number(r.shift_count)
    e.totalHours  += Number(r.hours ?? 0)
    e.breakdown.push({ shiftType: r.shiftType, shifts: Number(r.shift_count), hours: Number(r.hours ?? 0) })
  }
  return Object.values(empMap).map(e => ({ ...e, totalHours: Math.round(e.totalHours * 10) / 10 }))
}

// ── Cleanup Logs ──────────────────────────────────────────────────────────────

export async function getCleanupLog(flightId) {
  await ready()
  const { rows } = await client.execute({
    sql: 'SELECT * FROM cleanup_logs WHERE flightId = ? ORDER BY completedAt DESC', args: [flightId],
  })
  return rows[0] ?? null
}

export async function addCleanupLog(data) {
  await ready()
  const id = `cln-${Date.now()}`
  await client.execute({
    sql:  'INSERT INTO cleanup_logs (id,flightId,agentId,completedAt,tasksJson,status) VALUES (?,?,?,?,?,?)',
    args: [id, data.flightId, data.agentId, new Date().toISOString(), JSON.stringify(data.tasks), 'Completed'],
  })
  return getCleanupLog(data.flightId)
}
