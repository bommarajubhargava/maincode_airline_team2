// Mock flight data — 10 flights, 100 passengers each

function flightDate(hoursFromNow) {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + hoursFromNow)
  return d.toISOString()
}

export const FLIGHTS = [
  { id: 'flt-001', flightNumber: 'SW101', origin: 'New York (JFK)',    destination: 'London (LHR)',      departureTime: flightDate(2),  aircraft: 'Boeing 737',  passengers: 100, meals: { veg: 50, nonVeg: 20, halal: 10, vegan: 20 } },
  { id: 'flt-002', flightNumber: 'SW202', origin: 'London (LHR)',      destination: 'Dubai (DXB)',        departureTime: flightDate(4),  aircraft: 'Airbus A320', passengers: 100, meals: { veg: 45, nonVeg: 25, halal: 15, vegan: 15 } },
  { id: 'flt-003', flightNumber: 'SW303', origin: 'Dubai (DXB)',       destination: 'Mumbai (BOM)',       departureTime: flightDate(6),  aircraft: 'Boeing 777',  passengers: 100, meals: { veg: 55, nonVeg: 15, halal: 20, vegan: 10 } },
  { id: 'flt-004', flightNumber: 'SW404', origin: 'Mumbai (BOM)',      destination: 'Singapore (SIN)',    departureTime: flightDate(8),  aircraft: 'Airbus A380', passengers: 100, meals: { veg: 40, nonVeg: 30, halal: 10, vegan: 20 } },
  { id: 'flt-005', flightNumber: 'SW505', origin: 'Singapore (SIN)',   destination: 'Tokyo (NRT)',        departureTime: flightDate(10), aircraft: 'Boeing 787',  passengers: 100, meals: { veg: 30, nonVeg: 40, halal: 10, vegan: 20 } },
  { id: 'flt-006', flightNumber: 'SW606', origin: 'Tokyo (NRT)',       destination: 'Sydney (SYD)',       departureTime: flightDate(12), aircraft: 'Airbus A350', passengers: 100, meals: { veg: 35, nonVeg: 35, halal: 10, vegan: 20 } },
  { id: 'flt-007', flightNumber: 'SW707', origin: 'Sydney (SYD)',      destination: 'Los Angeles (LAX)',  departureTime: flightDate(14), aircraft: 'Boeing 777',  passengers: 100, meals: { veg: 50, nonVeg: 20, halal: 10, vegan: 20 } },
  { id: 'flt-008', flightNumber: 'SW808', origin: 'Los Angeles (LAX)', destination: 'Toronto (YYZ)',      departureTime: flightDate(16), aircraft: 'Boeing 737',  passengers: 100, meals: { veg: 45, nonVeg: 25, halal: 10, vegan: 20 } },
  { id: 'flt-009', flightNumber: 'SW909', origin: 'Toronto (YYZ)',     destination: 'Paris (CDG)',        departureTime: flightDate(18), aircraft: 'Airbus A320', passengers: 100, meals: { veg: 50, nonVeg: 20, halal: 10, vegan: 20 } },
  { id: 'flt-010', flightNumber: 'SW010', origin: 'Paris (CDG)',       destination: 'New York (JFK)',     departureTime: flightDate(20), aircraft: 'Boeing 787',  passengers: 100, meals: { veg: 50, nonVeg: 20, halal: 10, vegan: 20 } },
]

export const findFlightById = (id) => FLIGHTS.find(f => f.id === id)

export const CLEANUP_TASKS = [
  { key: 'lavatory_front',  label: 'Front Lavatory',                category: 'Toilets' },
  { key: 'lavatory_rear',   label: 'Rear Lavatory',                 category: 'Toilets' },
  { key: 'lavatory_mid',    label: 'Mid-Cabin Lavatory',            category: 'Toilets' },
  { key: 'seat_surfaces',   label: 'Seat Surfaces',                 category: 'Seats' },
  { key: 'tray_tables',     label: 'Tray Tables',                   category: 'Seats' },
  { key: 'seat_pockets',    label: 'Seat Pockets',                  category: 'Seats' },
  { key: 'headrests',       label: 'Headrest Covers',               category: 'Seats' },
  { key: 'aisle_vacuum',    label: 'Aisle Vacuuming',               category: 'Floors' },
  { key: 'galley_floor',    label: 'Galley / Lavatory Floor Mop',   category: 'Floors' },
  { key: 'overhead_bins',   label: 'Overhead Bins',                 category: 'Overhead' },
  { key: 'window_shades',   label: 'Window Shades',                 category: 'Overhead' },
  { key: 'galley_surfaces', label: 'Galley Surfaces',               category: 'Galley' },
  { key: 'waste_removal',   label: 'Waste Removal',                 category: 'Galley' },
]

// Checklist items required per flight (based on 100 passengers)
export function getChecklist(flight) {
  const { meals } = flight
  return [
    // Meals
    { key: 'vegMeals',     label: 'Veg Meals',          required: meals.veg,    unit: 'meals',   category: 'Meals' },
    { key: 'nonVegMeals',  label: 'Non-Veg Meals',      required: meals.nonVeg, unit: 'meals',   category: 'Meals' },
    { key: 'halalMeals',   label: 'Halal Meals',         required: meals.halal,  unit: 'meals',   category: 'Meals' },
    { key: 'veganMeals',   label: 'Vegan Meals',         required: meals.vegan,  unit: 'meals',   category: 'Meals' },
    // Beverages
    { key: 'water500ml',   label: 'Water Bottles (500ml)', required: 150,        unit: 'bottles', category: 'Beverages' },
    { key: 'water1L',      label: 'Water Bottles (1L)',    required: 30,         unit: 'bottles', category: 'Beverages' },
    { key: 'sugarPackets', label: 'Sugar Packets',         required: 200,        unit: 'packets', category: 'Beverages' },
    { key: 'teaCoffee',    label: 'Tea / Coffee Cups',     required: 120,        unit: 'cups',    category: 'Beverages' },
    // Medical
    { key: 'firstAidKit',  label: 'First Aid Kits',        required: 2,          unit: 'kits',    category: 'Medical' },
    { key: 'paracetamol',  label: 'Paracetamol',           required: 10,         unit: 'strips',  category: 'Medical' },
    { key: 'antacid',      label: 'Antacid',               required: 10,         unit: 'strips',  category: 'Medical' },
    // Supplies
    { key: 'sanitizer',    label: 'Sanitizer Bottles',     required: 15,         unit: 'bottles', category: 'Supplies' },
    { key: 'blankets',     label: 'Blankets',              required: 80,         unit: 'pieces',  category: 'Supplies' },
    { key: 'napkins',      label: 'Napkin Packs',          required: 50,         unit: 'packs',   category: 'Supplies' },
  ]
}
