// global preserves data across Next.js hot reloads in dev
if (!global._shifts) {
  global._shifts = generateShifts()
}

function generateShifts() {
  const shifts = []
  const staffIds = ['usr-001', 'usr-002', 'usr-003', 'usr-004', 'usr-005', 'usr-006', 'usr-007']
  const types = ['Morning', 'Afternoon', 'Evening', 'Night']
  const locations = [
    'Terminal 1 - Check-in', 'Terminal 2 - Gate A3', 'Terminal 3 - Boarding',
    'Gate B7', 'Gate C12', 'Runway Control', 'Baggage Claim',
    'Customer Service Desk', 'Security Checkpoint', 'VIP Lounge'
  ]
  const hours = { Morning: [6, 14], Afternoon: [14, 22], Evening: [16, 24], Night: [22, 30] }

  let counter = 1
  const seed = (n) => (n * 1664525 + 1013904223) & 0xffffffff
  let rng = 42

  const rand = (max) => { rng = seed(rng); return Math.abs(rng) % max }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const userId of staffIds) {
    for (let day = -5; day < 30; day++) {
      if (rand(7) < 2) continue
      const date = new Date(today)
      date.setDate(today.getDate() + day)
      const type = types[rand(types.length)]
      const [sh, eh] = hours[type]
      const start = new Date(date); start.setHours(sh)
      const end = new Date(date); end.setHours(eh)
      const statusOptions = ['Scheduled', 'Scheduled', 'Scheduled', 'Completed', 'Cancelled']
      const status = day < 0 ? 'Completed' : statusOptions[rand(statusOptions.length)]
      shifts.push({
        id: `shft-${String(counter++).padStart(4, '0')}`,
        userId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        location: locations[rand(locations.length)],
        shiftType: type,
        status,
      })
    }
  }
  return shifts
}

export const getShifts = () => global._shifts

export const findShiftById = (id) => global._shifts.find(s => s.id === id)

export const updateShift = (id, updates) => {
  const idx = global._shifts.findIndex(s => s.id === id)
  if (idx === -1) return null
  global._shifts[idx] = { ...global._shifts[idx], ...updates }
  return global._shifts[idx]
}
