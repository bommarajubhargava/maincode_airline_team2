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
    `CREATE TABLE IF NOT EXISTS rosters (
        id TEXT PRIMARY KEY, name TEXT NOT NULL,
        startDate TEXT NOT NULL, endDate TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Draft',
        createdAt TEXT NOT NULL, createdBy TEXT NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS roster_shifts (
        id TEXT PRIMARY KEY, rosterId TEXT NOT NULL,
        userId TEXT NOT NULL, startTime TEXT NOT NULL,
        endTime TEXT NOT NULL, location TEXT NOT NULL,
        shiftType TEXT NOT NULL, duty TEXT NOT NULL DEFAULT 'General',
        status TEXT NOT NULL DEFAULT 'Draft'
      )`,
    `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        senderId TEXT NOT NULL,
        senderName TEXT NOT NULL,
        type TEXT NOT NULL,
        channelId TEXT,
        recipientId TEXT,
        content TEXT NOT NULL,
        createdAt TEXT NOT NULL
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

  if (currentVersion < 3) {
    console.log('[initDb] running v3 reseed...')
    await wipeAndReseed()
    console.log('[initDb] reseed complete')
  }

  console.log('[initDb] done')
}

export async function forceReseed() {
  await ready()  // ensure tables exist first
  await wipeAndReseed()
}

async function wipeAndReseed() {
  await client.batch([
    'DELETE FROM flight_duty_logs',
    'DELETE FROM flights',
    'DELETE FROM roster_shifts',
    'DELETE FROM rosters',
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

  await client.execute({ sql: 'INSERT INTO seed_version (version) VALUES (?)', args: [3] })
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
    // ── Admin ──────────────────────────────────────────────────────────────
    { id: 'emp-admin',      name: 'Alex Admin',          email: 'admin@skystaff.com',           role: 'role-admin',   empId: 'ADMIN-001',    designation: 'System Administrator',        dept: 'IT',                  dob: '1985-06-15', doj: '2010-01-01', airport: null  },

    // ── YYZ ────────────────────────────────────────────────────────────────
    // Manager
    { id: 'emp-yyz-mgr',    name: 'Sarah Mitchell',      email: 'manager.yyz@skystaff.com',     role: 'role-manager', empId: 'YYZ-MGR-01',   designation: 'Airport Operations Manager',   dept: 'Airport Operations',  dob: '1980-03-22', doj: '2012-05-01', airport: 'YYZ' },
    // General ops agents (cover cleanup/catering/general duties at airport level)
    { id: 'emp-yyz-a1',     name: 'Tom Reid',            email: 'agent1.yyz@skystaff.com',      role: 'role-agent',   empId: 'YYZ-AGT-01',   designation: 'Morning Operations Agent',     dept: 'Ground Services',     dob: '1992-07-10', doj: '2018-03-15', airport: 'YYZ' },
    { id: 'emp-yyz-a2',     name: 'Lisa Park',           email: 'agent2.yyz@skystaff.com',      role: 'role-agent',   empId: 'YYZ-AGT-02',   designation: 'Afternoon Operations Agent',   dept: 'Ground Services',     dob: '1994-11-28', doj: '2019-08-01', airport: 'YYZ' },
    { id: 'emp-yyz-a3',     name: 'Carlos Reyes',        email: 'agent3.yyz@skystaff.com',      role: 'role-agent',   empId: 'YYZ-AGT-03',   designation: 'Night Operations Agent',       dept: 'Ground Services',     dob: '1990-04-05', doj: '2017-06-01', airport: 'YYZ' },
    // Ground Services / Ramp GSE
    { id: 'emp-yyz-gs1',    name: 'Ryan Cooper',         email: 'gs1.yyz@skystaff.com',         role: 'role-agent',   empId: 'YYZ-GS-01',    designation: 'Ramp Operator',                dept: 'Ground Services',     dob: '1991-03-15', doj: '2017-07-01', airport: 'YYZ' },
    { id: 'emp-yyz-gs2',    name: 'Jessica Chan',        email: 'gs2.yyz@skystaff.com',         role: 'role-agent',   empId: 'YYZ-GS-02',    designation: 'Ramp Operator',                dept: 'Ground Services',     dob: '1993-08-22', doj: '2019-01-15', airport: 'YYZ' },
    { id: 'emp-yyz-gs3',    name: 'Marcus Johnson',      email: 'gs3.yyz@skystaff.com',         role: 'role-agent',   empId: 'YYZ-GS-03',    designation: 'Ramp Operator',                dept: 'Ground Services',     dob: '1989-11-07', doj: '2016-04-01', airport: 'YYZ' },
    { id: 'emp-yyz-gs4',    name: 'Amanda Foster',       email: 'gs4.yyz@skystaff.com',         role: 'role-agent',   empId: 'YYZ-GS-04',    designation: 'GSE Supervisor',               dept: 'Ground Services',     dob: '1986-05-19', doj: '2014-09-01', airport: 'YYZ' },
    // Security / Operations
    { id: 'emp-yyz-sec1',   name: 'David Kim',           email: 'sec1.yyz@skystaff.com',        role: 'role-agent',   empId: 'YYZ-SEC-01',   designation: 'Security Officer',             dept: 'Operations',          dob: '1988-02-28', doj: '2015-06-01', airport: 'YYZ' },
    { id: 'emp-yyz-sec2',   name: 'Sarah Nguyen',        email: 'sec2.yyz@skystaff.com',        role: 'role-agent',   empId: 'YYZ-SEC-02',   designation: 'Security Officer',             dept: 'Operations',          dob: '1994-09-14', doj: '2020-02-01', airport: 'YYZ' },
    { id: 'emp-yyz-sec3',   name: 'Brian Walsh',         email: 'sec3.yyz@skystaff.com',        role: 'role-agent',   empId: 'YYZ-SEC-03',   designation: 'Security Officer',             dept: 'Operations',          dob: '1990-12-03', doj: '2018-08-15', airport: 'YYZ' },
    // Customer Service / Check-in
    { id: 'emp-yyz-cs1',    name: 'Emily Zhang',         email: 'cs1.yyz@skystaff.com',         role: 'role-agent',   empId: 'YYZ-CS-01',    designation: 'Check-in Agent',               dept: 'Customer Service',    dob: '1995-04-11', doj: '2021-03-01', airport: 'YYZ' },
    { id: 'emp-yyz-cs2',    name: 'Michael Torres',      email: 'cs2.yyz@skystaff.com',         role: 'role-agent',   empId: 'YYZ-CS-02',    designation: 'Check-in Agent',               dept: 'Customer Service',    dob: '1992-07-30', doj: '2019-11-01', airport: 'YYZ' },
    { id: 'emp-yyz-cs3',    name: 'Rachel Green',        email: 'cs3.yyz@skystaff.com',         role: 'role-agent',   empId: 'YYZ-CS-03',    designation: 'Service Desk Agent',           dept: 'Customer Service',    dob: '1993-01-25', doj: '2020-06-15', airport: 'YYZ' },
    { id: 'emp-yyz-cs4',    name: 'Kevin Park',          email: 'cs4.yyz@skystaff.com',         role: 'role-agent',   empId: 'YYZ-CS-04',    designation: 'Service Desk Agent',           dept: 'Customer Service',    dob: '1996-10-08', doj: '2022-01-10', airport: 'YYZ' },
    // Catering
    { id: 'emp-yyz-cat1',   name: 'Lisa Martinez',       email: 'cat1.yyz@skystaff.com',        role: 'role-agent',   empId: 'YYZ-CAT-01',   designation: 'Catering Agent',               dept: 'Catering Services',   dob: '1991-06-17', doj: '2018-04-01', airport: 'YYZ' },
    { id: 'emp-yyz-cat2',   name: 'James Wilson',        email: 'cat2.yyz@skystaff.com',        role: 'role-agent',   empId: 'YYZ-CAT-02',   designation: 'Catering Agent',               dept: 'Catering Services',   dob: '1987-09-04', doj: '2015-11-01', airport: 'YYZ' },
    // Gate / Boarding
    { id: 'emp-yyz-gate1',  name: 'Priya Sharma',        email: 'gate1.yyz@skystaff.com',       role: 'role-agent',   empId: 'YYZ-GATE-01',  designation: 'Gate Agent',                   dept: 'Gate Services',       dob: '1994-03-29', doj: '2020-09-01', airport: 'YYZ' },
    { id: 'emp-yyz-gate2',  name: 'Nathan Brooks',       email: 'gate2.yyz@skystaff.com',       role: 'role-agent',   empId: 'YYZ-GATE-02',  designation: 'Gate Agent',                   dept: 'Gate Services',       dob: '1992-11-16', doj: '2019-05-15', airport: 'YYZ' },
    { id: 'emp-yyz-gate3',  name: 'Sandra Lee',          email: 'gate3.yyz@skystaff.com',       role: 'role-agent',   empId: 'YYZ-GATE-03',  designation: 'Gate Agent',                   dept: 'Gate Services',       dob: '1990-08-21', doj: '2017-12-01', airport: 'YYZ' },

    // ── YTZ ────────────────────────────────────────────────────────────────
    { id: 'emp-ytz-mgr',    name: 'James O Brien',       email: 'manager.ytz@skystaff.com',     role: 'role-manager', empId: 'YTZ-MGR-01',   designation: 'Airport Operations Manager',   dept: 'Airport Operations',  dob: '1978-12-01', doj: '2011-09-01', airport: 'YTZ' },
    { id: 'emp-ytz-a1',     name: 'Nina Patel',          email: 'agent1.ytz@skystaff.com',      role: 'role-agent',   empId: 'YTZ-AGT-01',   designation: 'Morning Operations Agent',     dept: 'Ground Services',     dob: '1993-02-17', doj: '2018-11-01', airport: 'YTZ' },
    { id: 'emp-ytz-a2',     name: 'Marcus Hill',         email: 'agent2.ytz@skystaff.com',      role: 'role-agent',   empId: 'YTZ-AGT-02',   designation: 'Afternoon Operations Agent',   dept: 'Ground Services',     dob: '1991-08-30', doj: '2019-04-15', airport: 'YTZ' },
    { id: 'emp-ytz-a3',     name: 'Rosa Kim',            email: 'agent3.ytz@skystaff.com',      role: 'role-agent',   empId: 'YTZ-AGT-03',   designation: 'Night Operations Agent',       dept: 'Ground Services',     dob: '1995-05-22', doj: '2020-02-01', airport: 'YTZ' },
    { id: 'emp-ytz-gs1',    name: 'Oliver Hughes',       email: 'gs1.ytz@skystaff.com',         role: 'role-agent',   empId: 'YTZ-GS-01',    designation: 'Ramp Operator',                dept: 'Ground Services',     dob: '1990-04-12', doj: '2016-08-01', airport: 'YTZ' },
    { id: 'emp-ytz-gs2',    name: 'Mei Lin',             email: 'gs2.ytz@skystaff.com',         role: 'role-agent',   empId: 'YTZ-GS-02',    designation: 'Ramp Operator',                dept: 'Ground Services',     dob: '1994-07-03', doj: '2020-03-15', airport: 'YTZ' },
    { id: 'emp-ytz-gs3',    name: 'Andre Dubois',        email: 'gs3.ytz@skystaff.com',         role: 'role-agent',   empId: 'YTZ-GS-03',    designation: 'Ramp Operator',                dept: 'Ground Services',     dob: '1988-10-28', doj: '2015-02-01', airport: 'YTZ' },
    { id: 'emp-ytz-gs4',    name: 'Fatima Al-Hassan',    email: 'gs4.ytz@skystaff.com',         role: 'role-agent',   empId: 'YTZ-GS-04',    designation: 'GSE Supervisor',               dept: 'Ground Services',     dob: '1985-01-19', doj: '2013-06-01', airport: 'YTZ' },
    { id: 'emp-ytz-sec1',   name: 'Carlos Espinoza',     email: 'sec1.ytz@skystaff.com',        role: 'role-agent',   empId: 'YTZ-SEC-01',   designation: 'Security Officer',             dept: 'Operations',          dob: '1989-06-22', doj: '2016-01-15', airport: 'YTZ' },
    { id: 'emp-ytz-sec2',   name: 'Lily Chen',           email: 'sec2.ytz@skystaff.com',        role: 'role-agent',   empId: 'YTZ-SEC-02',   designation: 'Security Officer',             dept: 'Operations',          dob: '1995-11-09', doj: '2021-07-01', airport: 'YTZ' },
    { id: 'emp-ytz-sec3',   name: 'Thomas Adeyemi',      email: 'sec3.ytz@skystaff.com',        role: 'role-agent',   empId: 'YTZ-SEC-03',   designation: 'Security Officer',             dept: 'Operations',          dob: '1987-03-31', doj: '2014-10-01', airport: 'YTZ' },
    { id: 'emp-ytz-cs1',    name: 'Grace O Sullivan',    email: 'cs1.ytz@skystaff.com',         role: 'role-agent',   empId: 'YTZ-CS-01',    designation: 'Check-in Agent',               dept: 'Customer Service',    dob: '1996-08-14', doj: '2022-04-01', airport: 'YTZ' },
    { id: 'emp-ytz-cs2',    name: 'Samuel Yeboah',       email: 'cs2.ytz@skystaff.com',         role: 'role-agent',   empId: 'YTZ-CS-02',    designation: 'Check-in Agent',               dept: 'Customer Service',    dob: '1991-12-05', doj: '2018-09-15', airport: 'YTZ' },
    { id: 'emp-ytz-cs3',    name: 'Isabella Rossi',      email: 'cs3.ytz@skystaff.com',         role: 'role-agent',   empId: 'YTZ-CS-03',    designation: 'Service Desk Agent',           dept: 'Customer Service',    dob: '1993-04-27', doj: '2020-01-10', airport: 'YTZ' },
    { id: 'emp-ytz-cs4',    name: 'Daniel Okafor',       email: 'cs4.ytz@skystaff.com',         role: 'role-agent',   empId: 'YTZ-CS-04',    designation: 'Service Desk Agent',           dept: 'Customer Service',    dob: '1990-09-16', doj: '2017-05-01', airport: 'YTZ' },
    { id: 'emp-ytz-cat1',   name: 'Yuki Tanaka',         email: 'cat1.ytz@skystaff.com',        role: 'role-agent',   empId: 'YTZ-CAT-01',   designation: 'Catering Agent',               dept: 'Catering Services',   dob: '1992-02-08', doj: '2019-06-01', airport: 'YTZ' },
    { id: 'emp-ytz-cat2',   name: 'Ahmed Hassan',        email: 'cat2.ytz@skystaff.com',        role: 'role-agent',   empId: 'YTZ-CAT-02',   designation: 'Catering Agent',               dept: 'Catering Services',   dob: '1986-07-24', doj: '2014-03-01', airport: 'YTZ' },
    { id: 'emp-ytz-gate1',  name: 'Aisha Kamara',        email: 'gate1.ytz@skystaff.com',       role: 'role-agent',   empId: 'YTZ-GATE-01',  designation: 'Gate Agent',                   dept: 'Gate Services',       dob: '1997-05-01', doj: '2022-11-01', airport: 'YTZ' },
    { id: 'emp-ytz-gate2',  name: 'Luke Patterson',      email: 'gate2.ytz@skystaff.com',       role: 'role-agent',   empId: 'YTZ-GATE-02',  designation: 'Gate Agent',                   dept: 'Gate Services',       dob: '1993-10-19', doj: '2020-07-15', airport: 'YTZ' },
    { id: 'emp-ytz-gate3',  name: 'Zoe Williams',        email: 'gate3.ytz@skystaff.com',       role: 'role-agent',   empId: 'YTZ-GATE-03',  designation: 'Gate Agent',                   dept: 'Gate Services',       dob: '1991-01-30', doj: '2018-02-01', airport: 'YTZ' },

    // ── YHM ────────────────────────────────────────────────────────────────
    { id: 'emp-yhm-mgr',    name: 'Patricia Blake',      email: 'manager.yhm@skystaff.com',     role: 'role-manager', empId: 'YHM-MGR-01',   designation: 'Airport Operations Manager',   dept: 'Airport Operations',  dob: '1982-10-14', doj: '2013-07-01', airport: 'YHM' },
    { id: 'emp-yhm-a1',     name: 'Eric Taylor',         email: 'agent1.yhm@skystaff.com',      role: 'role-agent',   empId: 'YHM-AGT-01',   designation: 'Morning Operations Agent',     dept: 'Ground Services',     dob: '1989-06-03', doj: '2016-10-01', airport: 'YHM' },
    { id: 'emp-yhm-a2',     name: 'Sophie Brown',        email: 'agent2.yhm@skystaff.com',      role: 'role-agent',   empId: 'YHM-AGT-02',   designation: 'Afternoon Operations Agent',   dept: 'Ground Services',     dob: '1998-03-25', doj: '2022-09-01', airport: 'YHM' },
    { id: 'emp-yhm-a3',     name: 'Amir Hassan',         email: 'agent3.yhm@skystaff.com',      role: 'role-agent',   empId: 'YHM-AGT-03',   designation: 'Night Operations Agent',       dept: 'Ground Services',     dob: '1988-11-18', doj: '2015-04-01', airport: 'YHM' },
    { id: 'emp-yhm-gs1',    name: 'Derek Morrison',      email: 'gs1.yhm@skystaff.com',         role: 'role-agent',   empId: 'YHM-GS-01',    designation: 'Ramp Operator',                dept: 'Ground Services',     dob: '1990-07-11', doj: '2017-03-01', airport: 'YHM' },
    { id: 'emp-yhm-gs2',    name: 'Nadia Petrov',        email: 'gs2.yhm@skystaff.com',         role: 'role-agent',   empId: 'YHM-GS-02',    designation: 'Ramp Operator',                dept: 'Ground Services',     dob: '1993-12-04', doj: '2019-08-15', airport: 'YHM' },
    { id: 'emp-yhm-gs3',    name: 'Jamal Robinson',      email: 'gs3.yhm@skystaff.com',         role: 'role-agent',   empId: 'YHM-GS-03',    designation: 'Ramp Operator',                dept: 'Ground Services',     dob: '1987-04-26', doj: '2014-12-01', airport: 'YHM' },
    { id: 'emp-yhm-gs4',    name: 'Claire Bouchard',     email: 'gs4.yhm@skystaff.com',         role: 'role-agent',   empId: 'YHM-GS-04',    designation: 'GSE Supervisor',               dept: 'Ground Services',     dob: '1984-09-17', doj: '2012-05-01', airport: 'YHM' },
    { id: 'emp-yhm-sec1',   name: 'Victor Santos',       email: 'sec1.yhm@skystaff.com',        role: 'role-agent',   empId: 'YHM-SEC-01',   designation: 'Security Officer',             dept: 'Operations',          dob: '1986-02-09', doj: '2013-11-01', airport: 'YHM' },
    { id: 'emp-yhm-sec2',   name: 'Emma Johansson',      email: 'sec2.yhm@skystaff.com',        role: 'role-agent',   empId: 'YHM-SEC-02',   designation: 'Security Officer',             dept: 'Operations',          dob: '1995-06-23', doj: '2021-04-01', airport: 'YHM' },
    { id: 'emp-yhm-sec3',   name: 'Pierre Leblanc',      email: 'sec3.yhm@skystaff.com',        role: 'role-agent',   empId: 'YHM-SEC-03',   designation: 'Security Officer',             dept: 'Operations',          dob: '1989-08-15', doj: '2016-06-15', airport: 'YHM' },
    { id: 'emp-yhm-cs1',    name: 'Anya Krishnamurti',   email: 'cs1.yhm@skystaff.com',         role: 'role-agent',   empId: 'YHM-CS-01',    designation: 'Check-in Agent',               dept: 'Customer Service',    dob: '1994-03-06', doj: '2020-10-01', airport: 'YHM' },
    { id: 'emp-yhm-cs2',    name: 'Sean Murphy',         email: 'cs2.yhm@skystaff.com',         role: 'role-agent',   empId: 'YHM-CS-02',    designation: 'Check-in Agent',               dept: 'Customer Service',    dob: '1991-10-22', doj: '2018-07-01', airport: 'YHM' },
    { id: 'emp-yhm-cs3',    name: 'Leila Nkosi',         email: 'cs3.yhm@skystaff.com',         role: 'role-agent',   empId: 'YHM-CS-03',    designation: 'Service Desk Agent',           dept: 'Customer Service',    dob: '1993-07-14', doj: '2019-12-15', airport: 'YHM' },
    { id: 'emp-yhm-cs4',    name: 'Christopher Wade',    email: 'cs4.yhm@skystaff.com',         role: 'role-agent',   empId: 'YHM-CS-04',    designation: 'Service Desk Agent',           dept: 'Customer Service',    dob: '1988-05-31', doj: '2015-09-01', airport: 'YHM' },
    { id: 'emp-yhm-cat1',   name: 'Maria Silva',         email: 'cat1.yhm@skystaff.com',        role: 'role-agent',   empId: 'YHM-CAT-01',   designation: 'Catering Agent',               dept: 'Catering Services',   dob: '1990-01-13', doj: '2017-01-15', airport: 'YHM' },
    { id: 'emp-yhm-cat2',   name: 'Raj Patel',           email: 'cat2.yhm@skystaff.com',        role: 'role-agent',   empId: 'YHM-CAT-02',   designation: 'Catering Agent',               dept: 'Catering Services',   dob: '1986-11-27', doj: '2013-08-01', airport: 'YHM' },
    { id: 'emp-yhm-gate1',  name: 'Fiona McAllister',    email: 'gate1.yhm@skystaff.com',       role: 'role-agent',   empId: 'YHM-GATE-01',  designation: 'Gate Agent',                   dept: 'Gate Services',       dob: '1995-09-08', doj: '2021-02-01', airport: 'YHM' },
    { id: 'emp-yhm-gate2',  name: 'Hassan Mohammed',     email: 'gate2.yhm@skystaff.com',       role: 'role-agent',   empId: 'YHM-GATE-02',  designation: 'Gate Agent',                   dept: 'Gate Services',       dob: '1992-06-20', doj: '2019-03-01', airport: 'YHM' },
    { id: 'emp-yhm-gate3',  name: 'Ingrid Berg',         email: 'gate3.yhm@skystaff.com',       role: 'role-agent',   empId: 'YHM-GATE-03',  designation: 'Gate Agent',                   dept: 'Gate Services',       dob: '1989-04-02', doj: '2016-11-01', airport: 'YHM' },
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
async function seedShifts() {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0)
  const stmts = []
  let counter = 1
  const id = () => `shft-${String(counter++).padStart(4, '0')}`

  const airports = [
    {
      code: 'YYZ',
      // General ops agents: all 3 duties at airport code location
      general: [
        { emp: 'emp-yyz-a1', sh: '06', eh: '14', type: 'Morning' },
        { emp: 'emp-yyz-a2', sh: '14', eh: '22', type: 'Afternoon' },
        { emp: 'emp-yyz-a3', sh: '22', eh: '06+1', type: 'Night' },
      ],
      // Specialized staff
      specialized: [
        // Ground Services — Runway Control (General)
        { emp: 'emp-yyz-gs1',   sh: '06', eh: '14',   type: 'Morning',   loc: 'Runway Control',        duty: 'General'  },
        { emp: 'emp-yyz-gs2',   sh: '14', eh: '22',   type: 'Afternoon', loc: 'Runway Control',        duty: 'General'  },
        { emp: 'emp-yyz-gs3',   sh: '22', eh: '06+1', type: 'Night',     loc: 'Runway Control',        duty: 'General'  },
        { emp: 'emp-yyz-gs4',   sh: '06', eh: '14',   type: 'Morning',   loc: 'Runway Control',        duty: 'General'  },
        // Security — Security Checkpoint (General)
        { emp: 'emp-yyz-sec1',  sh: '06', eh: '14',   type: 'Morning',   loc: 'Security Checkpoint',   duty: 'General'  },
        { emp: 'emp-yyz-sec2',  sh: '14', eh: '22',   type: 'Afternoon', loc: 'Security Checkpoint',   duty: 'General'  },
        { emp: 'emp-yyz-sec3',  sh: '22', eh: '06+1', type: 'Night',     loc: 'Security Checkpoint',   duty: 'General'  },
        // Customer Service — Check-in (General)
        { emp: 'emp-yyz-cs1',   sh: '06', eh: '14',   type: 'Morning',   loc: 'Terminal 1 - Check-in', duty: 'General'  },
        { emp: 'emp-yyz-cs2',   sh: '14', eh: '22',   type: 'Afternoon', loc: 'Terminal 1 - Check-in', duty: 'General'  },
        // Customer Service — Service Desk (General)
        { emp: 'emp-yyz-cs3',   sh: '06', eh: '14',   type: 'Morning',   loc: 'Customer Service Desk', duty: 'General'  },
        { emp: 'emp-yyz-cs4',   sh: '14', eh: '22',   type: 'Afternoon', loc: 'Customer Service Desk', duty: 'General'  },
        // Catering — Gate A3 (Catering)
        { emp: 'emp-yyz-cat1',  sh: '06', eh: '14',   type: 'Morning',   loc: 'Terminal 2 - Gate A3',  duty: 'Catering' },
        { emp: 'emp-yyz-cat2',  sh: '14', eh: '22',   type: 'Afternoon', loc: 'Terminal 2 - Gate A3',  duty: 'Catering' },
        // Gate / Boarding (General)
        { emp: 'emp-yyz-gate1', sh: '06', eh: '14',   type: 'Morning',   loc: 'Terminal 3 - Boarding', duty: 'General'  },
        { emp: 'emp-yyz-gate2', sh: '14', eh: '22',   type: 'Afternoon', loc: 'Terminal 3 - Boarding', duty: 'General'  },
        { emp: 'emp-yyz-gate3', sh: '22', eh: '06+1', type: 'Night',     loc: 'Terminal 3 - Boarding', duty: 'General'  },
      ],
    },
    {
      code: 'YTZ',
      general: [
        { emp: 'emp-ytz-a1', sh: '06', eh: '14',   type: 'Morning'   },
        { emp: 'emp-ytz-a2', sh: '14', eh: '22',   type: 'Afternoon' },
        { emp: 'emp-ytz-a3', sh: '22', eh: '06+1', type: 'Night'     },
      ],
      specialized: [
        { emp: 'emp-ytz-gs1',   sh: '06', eh: '14',   type: 'Morning',   loc: 'Runway Control',        duty: 'General'  },
        { emp: 'emp-ytz-gs2',   sh: '14', eh: '22',   type: 'Afternoon', loc: 'Runway Control',        duty: 'General'  },
        { emp: 'emp-ytz-gs3',   sh: '22', eh: '06+1', type: 'Night',     loc: 'Runway Control',        duty: 'General'  },
        { emp: 'emp-ytz-gs4',   sh: '06', eh: '14',   type: 'Morning',   loc: 'Runway Control',        duty: 'General'  },
        { emp: 'emp-ytz-sec1',  sh: '06', eh: '14',   type: 'Morning',   loc: 'Security Checkpoint',   duty: 'General'  },
        { emp: 'emp-ytz-sec2',  sh: '14', eh: '22',   type: 'Afternoon', loc: 'Security Checkpoint',   duty: 'General'  },
        { emp: 'emp-ytz-sec3',  sh: '22', eh: '06+1', type: 'Night',     loc: 'Security Checkpoint',   duty: 'General'  },
        { emp: 'emp-ytz-cs1',   sh: '06', eh: '14',   type: 'Morning',   loc: 'Terminal 1 - Check-in', duty: 'General'  },
        { emp: 'emp-ytz-cs2',   sh: '14', eh: '22',   type: 'Afternoon', loc: 'Terminal 1 - Check-in', duty: 'General'  },
        { emp: 'emp-ytz-cs3',   sh: '06', eh: '14',   type: 'Morning',   loc: 'Customer Service Desk', duty: 'General'  },
        { emp: 'emp-ytz-cs4',   sh: '14', eh: '22',   type: 'Afternoon', loc: 'Customer Service Desk', duty: 'General'  },
        { emp: 'emp-ytz-cat1',  sh: '06', eh: '14',   type: 'Morning',   loc: 'Terminal 2 - Gate A3',  duty: 'Catering' },
        { emp: 'emp-ytz-cat2',  sh: '14', eh: '22',   type: 'Afternoon', loc: 'Terminal 2 - Gate A3',  duty: 'Catering' },
        { emp: 'emp-ytz-gate1', sh: '06', eh: '14',   type: 'Morning',   loc: 'Terminal 3 - Boarding', duty: 'General'  },
        { emp: 'emp-ytz-gate2', sh: '14', eh: '22',   type: 'Afternoon', loc: 'Terminal 3 - Boarding', duty: 'General'  },
        { emp: 'emp-ytz-gate3', sh: '22', eh: '06+1', type: 'Night',     loc: 'Terminal 3 - Boarding', duty: 'General'  },
      ],
    },
    {
      code: 'YHM',
      general: [
        { emp: 'emp-yhm-a1', sh: '06', eh: '14',   type: 'Morning'   },
        { emp: 'emp-yhm-a2', sh: '14', eh: '22',   type: 'Afternoon' },
        { emp: 'emp-yhm-a3', sh: '22', eh: '06+1', type: 'Night'     },
      ],
      specialized: [
        { emp: 'emp-yhm-gs1',   sh: '06', eh: '14',   type: 'Morning',   loc: 'Runway Control',        duty: 'General'  },
        { emp: 'emp-yhm-gs2',   sh: '14', eh: '22',   type: 'Afternoon', loc: 'Runway Control',        duty: 'General'  },
        { emp: 'emp-yhm-gs3',   sh: '22', eh: '06+1', type: 'Night',     loc: 'Runway Control',        duty: 'General'  },
        { emp: 'emp-yhm-gs4',   sh: '06', eh: '14',   type: 'Morning',   loc: 'Runway Control',        duty: 'General'  },
        { emp: 'emp-yhm-sec1',  sh: '06', eh: '14',   type: 'Morning',   loc: 'Security Checkpoint',   duty: 'General'  },
        { emp: 'emp-yhm-sec2',  sh: '14', eh: '22',   type: 'Afternoon', loc: 'Security Checkpoint',   duty: 'General'  },
        { emp: 'emp-yhm-sec3',  sh: '22', eh: '06+1', type: 'Night',     loc: 'Security Checkpoint',   duty: 'General'  },
        { emp: 'emp-yhm-cs1',   sh: '06', eh: '14',   type: 'Morning',   loc: 'Terminal 1 - Check-in', duty: 'General'  },
        { emp: 'emp-yhm-cs2',   sh: '14', eh: '22',   type: 'Afternoon', loc: 'Terminal 1 - Check-in', duty: 'General'  },
        { emp: 'emp-yhm-cs3',   sh: '06', eh: '14',   type: 'Morning',   loc: 'Customer Service Desk', duty: 'General'  },
        { emp: 'emp-yhm-cs4',   sh: '14', eh: '22',   type: 'Afternoon', loc: 'Customer Service Desk', duty: 'General'  },
        { emp: 'emp-yhm-cat1',  sh: '06', eh: '14',   type: 'Morning',   loc: 'Terminal 2 - Gate A3',  duty: 'Catering' },
        { emp: 'emp-yhm-cat2',  sh: '14', eh: '22',   type: 'Afternoon', loc: 'Terminal 2 - Gate A3',  duty: 'Catering' },
        { emp: 'emp-yhm-gate1', sh: '06', eh: '14',   type: 'Morning',   loc: 'Terminal 3 - Boarding', duty: 'General'  },
        { emp: 'emp-yhm-gate2', sh: '14', eh: '22',   type: 'Afternoon', loc: 'Terminal 3 - Boarding', duty: 'General'  },
        { emp: 'emp-yhm-gate3', sh: '22', eh: '06+1', type: 'Night',     loc: 'Terminal 3 - Boarding', duty: 'General'  },
      ],
    },
  ]

  const DUTIES = ['General', 'Catering', 'Cleanup']

  for (const ap of airports) {
    for (let offset = 0; offset < 10; offset++) {
      const d = new Date(today); d.setUTCDate(today.getUTCDate() + offset)
      const ds = d.toISOString().slice(0, 10)
      const nextDs = new Date(d); nextDs.setUTCDate(d.getUTCDate() + 1)
      const nextDsStr = nextDs.toISOString().slice(0, 10)

      const timeStr = (sh, eh) => {
        const start = `${ds}T${sh.padStart(2,'0')}:00:00.000Z`
        const end   = eh.endsWith('+1')
          ? `${nextDsStr}T${eh.replace('+1','').padStart(2,'0')}:00:00.000Z`
          : `${ds}T${eh.padStart(2,'0')}:00:00.000Z`
        return { start, end }
      }

      // General ops agents: 3 duty types each
      for (const ag of ap.general) {
        const { start, end } = timeStr(ag.sh, ag.eh)
        for (const duty of DUTIES) {
          stmts.push({ sql: 'INSERT INTO shifts (id,userId,startTime,endTime,location,shiftType,status,duty) VALUES (?,?,?,?,?,?,?,?)',
            args: [id(), ag.emp, start, end, ap.code, ag.type, 'Scheduled', duty] })
        }
      }

      // Specialized staff: single location + duty
      for (const sp of ap.specialized) {
        const { start, end } = timeStr(sp.sh, sp.eh)
        stmts.push({ sql: 'INSERT INTO shifts (id,userId,startTime,endTime,location,shiftType,status,duty) VALUES (?,?,?,?,?,?,?,?)',
          args: [id(), sp.emp, start, end, sp.loc, sp.type, 'Scheduled', sp.duty] })
      }
    }
  }

  const CHUNK = 50
  for (let i = 0; i < stmts.length; i += CHUNK) {
    await client.batch(stmts.slice(i, i + CHUNK), 'write')
  }
}

// ── Seed Flights (5 days × 4 flights/day per airport = 20 flights/airport) ───

async function seedFlights() {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0)

  function at(offset, hh, mm = 0) {
    const d = new Date(today)
    d.setUTCDate(today.getUTCDate() + offset)
    d.setUTCHours(hh, mm, 0, 0)
    return d.toISOString()
  }

  const flights = [
    // ── YYZ — Air Canada + WestJet (20 flights over 5 days) ──────────────
    // Day 0
    { id:'flt-yyz-d01', num:'AC101', from:'YYZ', to:'JFK', time:at(0,7,30),  type:'Departing', aircraft:'Boeing 737-800',    pax:168, apt:'YYZ' },
    { id:'flt-yyz-d02', num:'WJ201', from:'YYZ', to:'ORD', time:at(0,10,0),  type:'Departing', aircraft:'Boeing 737 MAX 8',  pax:175, apt:'YYZ' },
    { id:'flt-yyz-a01', num:'AC102', from:'JFK', to:'YYZ', time:at(0,13,30), type:'Arriving',  aircraft:'Boeing 737-800',    pax:162, apt:'YYZ' },
    { id:'flt-yyz-a02', num:'WJ202', from:'ORD', to:'YYZ', time:at(0,17,30), type:'Arriving',  aircraft:'Boeing 737 MAX 8',  pax:170, apt:'YYZ' },
    // Day 1
    { id:'flt-yyz-d03', num:'AC203', from:'YYZ', to:'LHR', time:at(1,8,0),   type:'Departing', aircraft:'Boeing 787-9',      pax:290, apt:'YYZ' },
    { id:'flt-yyz-d04', num:'WJ304', from:'YYZ', to:'LAX', time:at(1,11,30), type:'Departing', aircraft:'Airbus A321',       pax:185, apt:'YYZ' },
    { id:'flt-yyz-a03', num:'AC204', from:'LHR', to:'YYZ', time:at(1,15,45), type:'Arriving',  aircraft:'Boeing 787-9',      pax:285, apt:'YYZ' },
    { id:'flt-yyz-a04', num:'WJ305', from:'LAX', to:'YYZ', time:at(1,22,0),  type:'Arriving',  aircraft:'Airbus A321',       pax:180, apt:'YYZ' },
    // Day 2
    { id:'flt-yyz-d05', num:'AC305', from:'YYZ', to:'MIA', time:at(2,9,30),  type:'Departing', aircraft:'Airbus A320neo',    pax:156, apt:'YYZ' },
    { id:'flt-yyz-d06', num:'WJ406', from:'YYZ', to:'YUL', time:at(2,14,0),  type:'Departing', aircraft:'De Havilland Q400', pax:74,  apt:'YYZ' },
    { id:'flt-yyz-a05', num:'AC306', from:'MIA', to:'YYZ', time:at(2,16,0),  type:'Arriving',  aircraft:'Airbus A320neo',    pax:152, apt:'YYZ' },
    { id:'flt-yyz-a06', num:'WJ407', from:'YUL', to:'YYZ', time:at(2,19,30), type:'Arriving',  aircraft:'De Havilland Q400', pax:72,  apt:'YYZ' },
    // Day 3
    { id:'flt-yyz-d07', num:'AC407', from:'YYZ', to:'YOW', time:at(3,7,0),   type:'Departing', aircraft:'Embraer E175',      pax:78,  apt:'YYZ' },
    { id:'flt-yyz-d08', num:'WJ508', from:'YYZ', to:'JFK', time:at(3,12,0),  type:'Departing', aircraft:'Boeing 737-800',    pax:165, apt:'YYZ' },
    { id:'flt-yyz-a07', num:'AC408', from:'YOW', to:'YYZ', time:at(3,11,30), type:'Arriving',  aircraft:'Embraer E175',      pax:76,  apt:'YYZ' },
    { id:'flt-yyz-a08', num:'WJ509', from:'JFK', to:'YYZ', time:at(3,20,0),  type:'Arriving',  aircraft:'Boeing 737-800',    pax:161, apt:'YYZ' },
    // Day 4
    { id:'flt-yyz-d09', num:'AC509', from:'YYZ', to:'YYC', time:at(4,8,45),  type:'Departing', aircraft:'Boeing 737 MAX 8',  pax:175, apt:'YYZ' },
    { id:'flt-yyz-d10', num:'WJ610', from:'YYZ', to:'YVR', time:at(4,13,30), type:'Departing', aircraft:'Boeing 787-9',      pax:280, apt:'YYZ' },
    { id:'flt-yyz-a09', num:'AC510', from:'YYC', to:'YYZ', time:at(4,16,15), type:'Arriving',  aircraft:'Boeing 737 MAX 8',  pax:172, apt:'YYZ' },
    { id:'flt-yyz-a10', num:'WJ611', from:'YVR', to:'YYZ', time:at(4,21,0),  type:'Arriving',  aircraft:'Boeing 787-9',      pax:276, apt:'YYZ' },

    // ── YTZ — Porter Airlines (20 flights over 5 days) ────────────────────
    // Day 0
    { id:'flt-ytz-d01', num:'PD101', from:'YTZ', to:'YOW', time:at(0,7,0),   type:'Departing', aircraft:'De Havilland Q400', pax:74,  apt:'YTZ' },
    { id:'flt-ytz-d02', num:'PD103', from:'YTZ', to:'YUL', time:at(0,12,0),  type:'Departing', aircraft:'Embraer E195-E2',   pax:112, apt:'YTZ' },
    { id:'flt-ytz-a01', num:'PD102', from:'YOW', to:'YTZ', time:at(0,10,30), type:'Arriving',  aircraft:'De Havilland Q400', pax:72,  apt:'YTZ' },
    { id:'flt-ytz-a02', num:'PD104', from:'YUL', to:'YTZ', time:at(0,15,30), type:'Arriving',  aircraft:'Embraer E195-E2',   pax:110, apt:'YTZ' },
    // Day 1
    { id:'flt-ytz-d03', num:'PD203', from:'YTZ', to:'YHZ', time:at(1,7,30),  type:'Departing', aircraft:'De Havilland Q400', pax:76,  apt:'YTZ' },
    { id:'flt-ytz-d04', num:'PD205', from:'YTZ', to:'YYC', time:at(1,10,15), type:'Departing', aircraft:'Embraer E195-E2',   pax:108, apt:'YTZ' },
    { id:'flt-ytz-a03', num:'PD204', from:'YHZ', to:'YTZ', time:at(1,12,0),  type:'Arriving',  aircraft:'De Havilland Q400', pax:74,  apt:'YTZ' },
    { id:'flt-ytz-a04', num:'PD206', from:'YYC', to:'YTZ', time:at(1,19,30), type:'Arriving',  aircraft:'Embraer E195-E2',   pax:106, apt:'YTZ' },
    // Day 2
    { id:'flt-ytz-d05', num:'PD305', from:'YTZ', to:'YEG', time:at(2,9,0),   type:'Departing', aircraft:'De Havilland Q400', pax:78,  apt:'YTZ' },
    { id:'flt-ytz-d06', num:'PD307', from:'YTZ', to:'YWG', time:at(2,13,45), type:'Departing', aircraft:'Embraer E195-E2',   pax:110, apt:'YTZ' },
    { id:'flt-ytz-a05', num:'PD306', from:'YEG', to:'YTZ', time:at(2,16,0),  type:'Arriving',  aircraft:'De Havilland Q400', pax:76,  apt:'YTZ' },
    { id:'flt-ytz-a06', num:'PD308', from:'YWG', to:'YTZ', time:at(2,20,15), type:'Arriving',  aircraft:'Embraer E195-E2',   pax:108, apt:'YTZ' },
    // Day 3
    { id:'flt-ytz-d07', num:'PD407', from:'YTZ', to:'YVR', time:at(3,6,45),  type:'Departing', aircraft:'Embraer E195-E2',   pax:112, apt:'YTZ' },
    { id:'flt-ytz-d08', num:'PD409', from:'YTZ', to:'YOW', time:at(3,11,0),  type:'Departing', aircraft:'De Havilland Q400', pax:70,  apt:'YTZ' },
    { id:'flt-ytz-a07', num:'PD408', from:'YVR', to:'YTZ', time:at(3,19,30), type:'Arriving',  aircraft:'Embraer E195-E2',   pax:110, apt:'YTZ' },
    { id:'flt-ytz-a08', num:'PD410', from:'YOW', to:'YTZ', time:at(3,14,30), type:'Arriving',  aircraft:'De Havilland Q400', pax:68,  apt:'YTZ' },
    // Day 4
    { id:'flt-ytz-d09', num:'PD509', from:'YTZ', to:'YHZ', time:at(4,8,30),  type:'Departing', aircraft:'De Havilland Q400', pax:74,  apt:'YTZ' },
    { id:'flt-ytz-d10', num:'PD511', from:'YTZ', to:'YUL', time:at(4,14,0),  type:'Departing', aircraft:'Embraer E195-E2',   pax:114, apt:'YTZ' },
    { id:'flt-ytz-a09', num:'PD510', from:'YHZ', to:'YTZ', time:at(4,12,0),  type:'Arriving',  aircraft:'De Havilland Q400', pax:72,  apt:'YTZ' },
    { id:'flt-ytz-a10', num:'PD512', from:'YUL', to:'YTZ', time:at(4,18,30), type:'Arriving',  aircraft:'Embraer E195-E2',   pax:112, apt:'YTZ' },

    // ── YHM — Swoop / Flair / Charter (20 flights over 5 days) ───────────
    // Day 0
    { id:'flt-yhm-d01', num:'WO101', from:'YHM', to:'YYZ', time:at(0,8,0),   type:'Departing', aircraft:'Boeing 737-800',    pax:148, apt:'YHM' },
    { id:'flt-yhm-d02', num:'F8201', from:'YHM', to:'YUL', time:at(0,12,30), type:'Departing', aircraft:'Boeing 737 MAX 8',  pax:172, apt:'YHM' },
    { id:'flt-yhm-a01', num:'WO102', from:'YYZ', to:'YHM', time:at(0,11,30), type:'Arriving',  aircraft:'Boeing 737-800',    pax:145, apt:'YHM' },
    { id:'flt-yhm-a02', num:'F8202', from:'YUL', to:'YHM', time:at(0,17,0),  type:'Arriving',  aircraft:'Boeing 737 MAX 8',  pax:168, apt:'YHM' },
    // Day 1
    { id:'flt-yhm-d03', num:'WO203', from:'YHM', to:'YOW', time:at(1,7,0),   type:'Departing', aircraft:'Airbus A319',       pax:132, apt:'YHM' },
    { id:'flt-yhm-d04', num:'F8304', from:'YHM', to:'YVR', time:at(1,10,0),  type:'Departing', aircraft:'Boeing 737 MAX 8',  pax:175, apt:'YHM' },
    { id:'flt-yhm-a03', num:'WO204', from:'YOW', to:'YHM', time:at(1,14,30), type:'Arriving',  aircraft:'Airbus A319',       pax:130, apt:'YHM' },
    { id:'flt-yhm-a04', num:'F8305', from:'YVR', to:'YHM', time:at(1,21,15), type:'Arriving',  aircraft:'Boeing 737 MAX 8',  pax:170, apt:'YHM' },
    // Day 2
    { id:'flt-yhm-d05', num:'WO305', from:'YHM', to:'YYC', time:at(2,9,30),  type:'Departing', aircraft:'Airbus A320',       pax:158, apt:'YHM' },
    { id:'flt-yhm-d06', num:'F8406', from:'YHM', to:'YWG', time:at(2,13,0),  type:'Departing', aircraft:'Boeing 737-800',    pax:150, apt:'YHM' },
    { id:'flt-yhm-a05', num:'WO306', from:'YYC', to:'YHM', time:at(2,17,30), type:'Arriving',  aircraft:'Airbus A320',       pax:155, apt:'YHM' },
    { id:'flt-yhm-a06', num:'F8407', from:'YWG', to:'YHM', time:at(2,20,0),  type:'Arriving',  aircraft:'Boeing 737-800',    pax:148, apt:'YHM' },
    // Day 3
    { id:'flt-yhm-d07', num:'WO407', from:'YHM', to:'YHZ', time:at(3,8,30),  type:'Departing', aircraft:'Airbus A319',       pax:128, apt:'YHM' },
    { id:'flt-yhm-d08', num:'F8508', from:'YHM', to:'YEG', time:at(3,11,0),  type:'Departing', aircraft:'Boeing 737 MAX 8',  pax:170, apt:'YHM' },
    { id:'flt-yhm-a07', num:'WO408', from:'YHZ', to:'YHM', time:at(3,14,0),  type:'Arriving',  aircraft:'Airbus A319',       pax:126, apt:'YHM' },
    { id:'flt-yhm-a08', num:'F8509', from:'YEG', to:'YHM', time:at(3,19,0),  type:'Arriving',  aircraft:'Boeing 737 MAX 8',  pax:167, apt:'YHM' },
    // Day 4
    { id:'flt-yhm-d09', num:'WO509', from:'YHM', to:'YYZ', time:at(4,7,45),  type:'Departing', aircraft:'Boeing 737-800',    pax:148, apt:'YHM' },
    { id:'flt-yhm-d10', num:'F8610', from:'YHM', to:'YUL', time:at(4,12,30), type:'Departing', aircraft:'Airbus A320',       pax:162, apt:'YHM' },
    { id:'flt-yhm-a09', num:'WO510', from:'YYZ', to:'YHM', time:at(4,15,0),  type:'Arriving',  aircraft:'Boeing 737-800',    pax:145, apt:'YHM' },
    { id:'flt-yhm-a10', num:'F8611', from:'YUL', to:'YHM', time:at(4,21,30), type:'Arriving',  aircraft:'Airbus A320',       pax:159, apt:'YHM' },
  ]

  const CHUNK = 30
  for (let i = 0; i < flights.length; i += CHUNK) {
    await client.batch(
      flights.slice(i, i + CHUNK).map(f => ({
        sql: 'INSERT INTO flights (id,flight_number,from_airport,to_airport,scheduled_time,flight_type,aircraft,passenger_count,airport_id) VALUES (?,?,?,?,?,?,?,?,?)',
        args: [f.id, f.num, f.from, f.to, f.time, f.type, f.aircraft, f.pax, f.apt],
      })),
      'write'
    )
  }
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
// location (string) narrows results to shifts at a specific coverage-rule location
export async function getEmployeesByShiftDutyAndDate(date, shiftDuty, airportId, flightTime, location) {
  await ready()
  const args = [date, shiftDuty]
  const extras = []
  if (airportId)  { extras.push('e.airport_id = ?');                    args.push(airportId) }
  if (location)   { extras.push('s.location = ?');                      args.push(location) }
  if (flightTime) { extras.push('s.startTime <= ? AND s.endTime > ?');  args.push(flightTime, flightTime) }
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

// ── Rosters ───────────────────────────────────────────────────────────────────

export async function getRosters() {
  await ready()
  const { rows } = await client.execute('SELECT * FROM rosters ORDER BY createdAt DESC')
  return rows
}

export async function findRosterById(id) {
  await ready()
  const { rows } = await client.execute({ sql: 'SELECT * FROM rosters WHERE id = ?', args: [id] })
  return rows[0] ?? null
}

export async function getRosterShifts(rosterId) {
  await ready()
  const { rows } = await client.execute({ sql: 'SELECT * FROM roster_shifts WHERE rosterId = ? ORDER BY startTime', args: [rosterId] })
  return rows
}

export async function createRoster(data) {
  await ready()
  const id        = `rst-${Date.now()}`
  const createdAt = new Date().toISOString()
  await client.execute({
    sql:  `INSERT INTO rosters (id,name,startDate,endDate,status,createdAt,createdBy) VALUES (?,?,?,?,'Draft',?,?)`,
    args: [id, data.name, data.startDate, data.endDate, createdAt, data.createdBy],
  })
  return findRosterById(id)
}

export async function saveRosterShifts(rosterId, shifts) {
  await ready()
  const stmts = [{ sql: 'DELETE FROM roster_shifts WHERE rosterId = ?', args: [rosterId] }]
  for (const r of shifts) {
    stmts.push({
      sql:  `INSERT INTO roster_shifts (id,rosterId,userId,startTime,endTime,location,shiftType,duty,status) VALUES (?,?,?,?,?,?,?,?,?)`,
      args: [r.id, rosterId, r.userId, r.startTime, r.endTime, r.location, r.shiftType, r.duty ?? 'General', 'Draft'],
    })
  }
  const CHUNK = 50
  for (let i = 0; i < stmts.length; i += CHUNK) {
    await client.batch(stmts.slice(i, i + CHUNK), 'write')
  }
}

export async function publishRoster(rosterId) {
  await ready()
  const roster = await findRosterById(rosterId)
  if (!roster) return null
  const rosterShifts = await getRosterShifts(rosterId)
  const base = Date.now()
  // Use index-based suffix so IDs are guaranteed unique within this batch
  const stmts = rosterShifts.map((rs, i) => ({
    sql:  `INSERT OR IGNORE INTO shifts (id,userId,startTime,endTime,location,shiftType,status,duty) VALUES (?,?,?,?,?,?,'Scheduled',?)`,
    args: [`shft-r${base}-${String(i).padStart(5, '0')}`, rs.userId, rs.startTime, rs.endTime, rs.location, rs.shiftType, rs.duty],
  }))
  stmts.push({ sql: `UPDATE rosters SET status = 'Published' WHERE id = ?`, args: [rosterId] })
  const CHUNK = 50
  for (let i = 0; i < stmts.length; i += CHUNK) {
    await client.batch(stmts.slice(i, i + CHUNK), 'write')
  }
  return findRosterById(rosterId)
}

export async function deleteRoster(id) {
  await ready()
  await client.execute({ sql: 'DELETE FROM roster_shifts WHERE rosterId = ?', args: [id] })
  const { rowsAffected } = await client.execute({ sql: 'DELETE FROM rosters WHERE id = ?', args: [id] })
  return rowsAffected > 0
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function getChannelMessages(channelId, limit = 50) {
  await ready()
  const { rows } = await client.execute({
    sql: 'SELECT * FROM messages WHERE type = ? AND channelId = ? ORDER BY createdAt DESC LIMIT ?',
    args: ['channel', channelId, limit],
  })
  return rows.reverse()
}

export async function getDirectMessages(userId1, userId2, limit = 50) {
  await ready()
  const { rows } = await client.execute({
    sql: `SELECT * FROM messages WHERE type = 'direct'
          AND ((senderId = ? AND recipientId = ?) OR (senderId = ? AND recipientId = ?))
          ORDER BY createdAt DESC LIMIT ?`,
    args: [userId1, userId2, userId2, userId1, limit],
  })
  return rows.reverse()
}

export async function sendMessage({ senderId, senderName, type, channelId, recipientId, content }) {
  await ready()
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const createdAt = new Date().toISOString()
  await client.execute({
    sql: 'INSERT INTO messages (id,senderId,senderName,type,channelId,recipientId,content,createdAt) VALUES (?,?,?,?,?,?,?,?)',
    args: [id, senderId, senderName, type, channelId ?? null, recipientId ?? null, content, createdAt],
  })
  return { id, senderId, senderName, type, channelId, recipientId, content, createdAt }
}

export async function getUnreadCount(userId, since) {
  await ready()
  const { rows } = await client.execute({
    sql: `SELECT COUNT(*) as cnt FROM messages
          WHERE createdAt > ? AND senderId != ?
          AND (
            (type = 'direct' AND recipientId = ?)
          )`,
    args: [since, userId, userId],
  })
  return Number(rows[0]?.cnt ?? 0)
}

export async function getDMConversations(userId) {
  await ready()
  const { rows } = await client.execute({
    sql: `SELECT DISTINCT
            CASE WHEN senderId = ? THEN recipientId ELSE senderId END as peerId,
            CASE WHEN senderId = ? THEN senderName ELSE senderName END as peerName,
            MAX(createdAt) as lastAt
          FROM messages
          WHERE type = 'direct' AND (senderId = ? OR recipientId = ?)
          GROUP BY peerId
          ORDER BY lastAt DESC`,
    args: [userId, userId, userId, userId],
  })
  return rows
}
