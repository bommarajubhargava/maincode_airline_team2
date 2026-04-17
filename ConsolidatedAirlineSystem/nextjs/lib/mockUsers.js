import bcrypt from 'bcryptjs'

const hash = (pw) => bcrypt.hashSync(pw, 10)

export const mockUsers = [
  { id: 'usr-001', name: 'Alice Johnson',   email: 'staff1@airline.com',   passwordHash: hash('password123'), role: 'Staff',   employeeId: 'EMP001', department: 'Operations' },
  { id: 'usr-002', name: 'Bob Smith',       email: 'staff2@airline.com',   passwordHash: hash('password123'), role: 'Staff',   employeeId: 'EMP002', department: 'Operations' },
  { id: 'usr-003', name: 'Carol Davis',     email: 'staff3@airline.com',   passwordHash: hash('password123'), role: 'Staff',   employeeId: 'EMP003', department: 'Ground Services' },
  { id: 'usr-004', name: 'David Wilson',    email: 'staff4@airline.com',   passwordHash: hash('password123'), role: 'Staff',   employeeId: 'EMP004', department: 'Ground Services' },
  { id: 'usr-005', name: 'Emma Brown',      email: 'staff5@airline.com',   passwordHash: hash('password123'), role: 'Staff',   employeeId: 'EMP005', department: 'Cabin Crew' },
  { id: 'usr-006', name: 'Frank Miller',    email: 'agent1@airline.com',   passwordHash: hash('password123'), role: 'Agent',   employeeId: 'EMP006', department: 'Customer Service' },
  { id: 'usr-007', name: 'Grace Lee',       email: 'agent2@airline.com',   passwordHash: hash('password123'), role: 'Agent',   employeeId: 'EMP007', department: 'Customer Service' },
  { id: 'usr-008', name: 'Henry Taylor',    email: 'manager1@airline.com', passwordHash: hash('password123'), role: 'Manager', employeeId: 'EMP008', department: 'Operations' },
  { id: 'usr-009', name: 'Isabel Martinez', email: 'manager2@airline.com', passwordHash: hash('password123'), role: 'Manager', employeeId: 'EMP009', department: 'Ground Services' },
  { id: 'usr-010', name: 'James Admin',     email: 'admin@airline.com',    passwordHash: hash('password123'), role: 'Admin',   employeeId: 'EMP010', department: 'IT' },
  { id: 'usr-011', name: 'Kevin Park',      email: 'staff6@airline.com',   passwordHash: hash('password123'), role: 'Staff',   employeeId: 'EMP011', department: 'Operations' },
  { id: 'usr-012', name: 'Linda Chen',      email: 'staff7@airline.com',   passwordHash: hash('password123'), role: 'Staff',   employeeId: 'EMP012', department: 'Cabin Crew' },
  { id: 'usr-013', name: 'Mark Johnson',    email: 'agent3@airline.com',   passwordHash: hash('password123'), role: 'Agent',   employeeId: 'EMP013', department: 'Customer Service' },
  // Additional 10 agents (IDs 014-023) to reach 20 schedulable employees
  { id: 'usr-014', name: 'Nina Patel',      email: 'agent4@airline.com',   passwordHash: hash('password123'), role: 'Agent',   employeeId: 'EMP014', department: 'Ground Services' },
  { id: 'usr-015', name: 'Oscar Rivera',    email: 'agent5@airline.com',   passwordHash: hash('password123'), role: 'Agent',   employeeId: 'EMP015', department: 'Customer Service' },
  { id: 'usr-016', name: 'Priya Singh',     email: 'staff8@airline.com',   passwordHash: hash('password123'), role: 'Staff',   employeeId: 'EMP016', department: 'Cabin Crew' },
  { id: 'usr-017', name: 'Quinn Adams',     email: 'staff9@airline.com',   passwordHash: hash('password123'), role: 'Staff',   employeeId: 'EMP017', department: 'Operations' },
  { id: 'usr-018', name: 'Rachel Kim',      email: 'agent6@airline.com',   passwordHash: hash('password123'), role: 'Agent',   employeeId: 'EMP018', department: 'Ground Services' },
  { id: 'usr-019', name: 'Samuel Torres',   email: 'agent7@airline.com',   passwordHash: hash('password123'), role: 'Agent',   employeeId: 'EMP019', department: 'Customer Service' },
  { id: 'usr-020', name: 'Tina Nguyen',     email: 'staff10@airline.com',  passwordHash: hash('password123'), role: 'Staff',   employeeId: 'EMP020', department: 'Cabin Crew' },
  { id: 'usr-021', name: 'Umar Hassan',     email: 'agent8@airline.com',   passwordHash: hash('password123'), role: 'Agent',   employeeId: 'EMP021', department: 'Ground Services' },
  { id: 'usr-022', name: 'Vera Kowalski',   email: 'staff11@airline.com',  passwordHash: hash('password123'), role: 'Staff',   employeeId: 'EMP022', department: 'Operations' },
  { id: 'usr-023', name: 'Wei Zhang',       email: 'agent9@airline.com',   passwordHash: hash('password123'), role: 'Agent',   employeeId: 'EMP023', department: 'Customer Service' },
]

export const findUserByEmail = (email) =>
  mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase())

export const findUserById = (id) =>
  mockUsers.find(u => u.id === id)

export const safeUser = (u) => ({
  id: u.id, name: u.name, email: u.email,
  role: u.role, employeeId: u.employeeId, department: u.department
})
