// Duty definitions for departing and arriving flights.
// Each duty has a unique key, label, icon, and form schema.
// Form field types: 'number' | 'text' | 'select' | 'checkbox' | 'checklist'

export const DEPARTING_DUTIES = [
  {
    key: 'fueling',
    label: 'Aircraft Fueling',
    icon: '⛽',
    description: 'Load fuel and verify quantities before departure.',
    fields: [
      { key: 'fuelQty',      label: 'Fuel Quantity (kg)',  type: 'number',   required: true },
      { key: 'fuelType',     label: 'Fuel Type',           type: 'select',   required: true, options: ['Jet-A', 'Avtur', 'JP-8'] },
      { key: 'fuelComplete', label: 'Fueling complete and caps secured', type: 'checkbox', required: true },
    ],
  },
  {
    key: 'catering_load',
    label: 'Catering Loading',
    icon: '🍽️',
    description: 'Load all meals and beverages for the flight.',
    fields: [
      { key: 'vegMeals',     label: 'Veg Meals Loaded',          type: 'number',   required: true },
      { key: 'nonVegMeals',  label: 'Non-Veg Meals Loaded',      type: 'number',   required: true },
      { key: 'beverages',    label: 'Beverage Units Loaded',      type: 'number',   required: true },
      { key: 'specialMeals', label: 'Special/Halal Meals Loaded', type: 'number',   required: true },
      { key: 'galleyStocked',label: 'Galley fully stocked and secured', type: 'checkbox', required: true },
    ],
  },
  {
    key: 'cabin_clean_dep',
    label: 'Pre-Departure Cabin Cleaning',
    icon: '🧹',
    description: 'Clean and prepare the cabin before boarding.',
    type: 'checklist',
    items: [
      'Seats wiped and sanitized',
      'Lavatories cleaned and fully stocked',
      'Overhead bins cleared and cleaned',
      'Floors vacuumed and spot-mopped',
      'Tray tables cleaned and stowed',
      'Safety cards placed in seat pockets',
      'Blankets and pillows placed',
      'Waste bags replaced in all lavatories',
    ],
  },
  {
    key: 'baggage_load',
    label: 'Baggage & Cargo Loading',
    icon: '🧳',
    description: 'Load all passenger baggage and cargo into hold.',
    fields: [
      { key: 'bagCount',    label: 'Total Bags Loaded',       type: 'number',   required: true },
      { key: 'cargoWeight', label: 'Total Hold Weight (kg)',  type: 'number',   required: true },
      { key: 'holdSecured', label: 'Cargo hold sealed and locked', type: 'checkbox', required: true },
    ],
  },
  {
    key: 'security_check',
    label: 'Security & Documentation',
    icon: '🔒',
    description: 'Final security sweep and manifest verification.',
    type: 'checklist',
    items: [
      'Passenger manifest verified',
      'All passenger IDs checked at gate',
      'Carry-on screening completed',
      'No unauthorized items detected',
      'Security seal applied to cargo hold',
      'Aircraft perimeter walk completed',
    ],
  },
  {
    key: 'passenger_boarding',
    label: 'Passenger Boarding',
    icon: '🚶',
    description: 'Manage boarding process and seat all passengers.',
    fields: [
      { key: 'passengersBoarded', label: 'Passengers Boarded',  type: 'number',   required: true },
      { key: 'gateNumber',        label: 'Gate Number',          type: 'text',     required: true },
      { key: 'allBoarded',        label: 'All passengers boarded and seated', type: 'checkbox', required: true },
      { key: 'doorsArmed',        label: 'All cabin doors armed and cross-checked', type: 'checkbox', required: true },
    ],
  },
  {
    key: 'safety_briefing',
    label: 'Safety Briefing',
    icon: '🦺',
    description: 'Conduct pre-flight safety demonstration.',
    type: 'checklist',
    items: [
      'Emergency exits located and demonstrated',
      'Seatbelt fastening and adjustment shown',
      'Brace position explained',
      'Oxygen mask drop-down demonstrated',
      'Electronic devices policy communicated',
      'Life jacket location and usage shown',
    ],
  },
]

export const ARRIVING_DUTIES = [
  {
    key: 'disembarkation',
    label: 'Passenger Disembarkation',
    icon: '🚪',
    description: 'Manage safe and orderly passenger deplaning.',
    fields: [
      { key: 'passengersOff',      label: 'Passengers Offboarded',       type: 'number',   required: true },
      { key: 'jetbridgeConnected', label: 'Jet bridge / stairs connected', type: 'checkbox', required: true },
      { key: 'allDebarked',        label: 'All passengers disembarked',   type: 'checkbox', required: true },
    ],
  },
  {
    key: 'baggage_unload',
    label: 'Baggage Unloading',
    icon: '📦',
    description: 'Unload all baggage and cargo from the hold.',
    fields: [
      { key: 'bagsUnloaded',  label: 'Total Bags Unloaded',       type: 'number',   required: true },
      { key: 'allAccounted',  label: 'All bags on belt / accounted for', type: 'checkbox', required: true },
      { key: 'holdCleared',   label: 'Cargo hold fully cleared',  type: 'checkbox', required: true },
    ],
  },
  {
    key: 'waste_removal',
    label: 'Waste Removal',
    icon: '🗑️',
    description: 'Remove all waste from cabin and hold.',
    fields: [
      { key: 'wasteBags',        label: 'Waste Bags Removed',               type: 'number',   required: true },
      { key: 'hazardDisposed',   label: 'Hazardous waste properly disposed', type: 'checkbox', required: true },
      { key: 'wasteComplete',    label: 'Waste removal complete',            type: 'checkbox', required: true },
    ],
  },
  {
    key: 'cabin_clean_arr',
    label: 'Post-Arrival Cabin Cleaning',
    icon: '🧹',
    description: 'Deep clean the cabin after arrival.',
    type: 'checklist',
    items: [
      'All seats cleaned and sanitized',
      'Lavatories deep cleaned and restocked',
      'Floors vacuumed and mopped',
      'Overhead bins emptied and cleaned',
      'Tray tables disinfected',
      'Galley thoroughly cleaned',
      'Blankets and pillows replaced',
      'Safety equipment checked and in place',
    ],
  },
  {
    key: 'aircraft_inspection',
    label: 'Post-Flight Aircraft Inspection',
    icon: '🔧',
    description: 'Technical inspection of aircraft after landing.',
    type: 'checklist',
    items: [
      'Engine visual inspection completed',
      'Landing gear inspected',
      'Fuselage exterior checked for damage',
      'Navigation and exterior lights verified',
      'Tire pressure checked on all wheels',
      'Hydraulic fluid levels checked',
      'APU operational check done',
      'Aircraft log updated',
    ],
  },
  {
    key: 'catering_restock',
    label: 'Catering Restock',
    icon: '🛒',
    description: 'Restock the galley for the next flight.',
    type: 'checklist',
    items: [
      'All leftover and expired meals removed',
      'Galley cleaned and sanitized',
      'Fresh meals loaded and counted',
      'Beverages fully restocked',
      'Catering manifest verified',
      'Galley equipment checked and secured',
    ],
  },
]

// Maps each flight duty key to the shift duty type responsible for it.
export const DUTY_KEY_TO_SHIFT_DUTY = {
  fueling:              'General',
  catering_load:        'Catering',
  cabin_clean_dep:      'Cleanup',
  baggage_load:         'General',
  security_check:       'General',
  passenger_boarding:   'General',
  safety_briefing:      'General',
  disembarkation:       'General',
  baggage_unload:       'General',
  waste_removal:        'Cleanup',
  cabin_clean_arr:      'Cleanup',
  aircraft_inspection:  'General',
  catering_restock:     'Catering',
}

// Maps each duty to the coverage-rule location whose staff are responsible.
// null = any airport staff with the matching shift-duty type.
export const DUTY_KEY_TO_LOCATION = {
  fueling:             'Runway Control',        // Ramp GSE team
  baggage_load:        'Runway Control',        // Ramp GSE team
  baggage_unload:      'Runway Control',        // Ramp GSE team
  aircraft_inspection: 'Runway Control',        // Ramp GSE team
  catering_load:       'Terminal 2 - Gate A3', // Catering Load Team
  catering_restock:    'Terminal 2 - Gate A3', // Catering Load Team
  security_check:      'Security Checkpoint',  // Security team
  passenger_boarding:  'Terminal 3 - Boarding', // Gate Boarding Staff
  disembarkation:      'Terminal 3 - Boarding', // Gate Boarding Staff
  safety_briefing:     'Terminal 3 - Boarding', // Gate Boarding Staff
  cabin_clean_dep:     null,                   // Cleanup duty — any airport
  cabin_clean_arr:     null,                   // Cleanup duty — any airport
  waste_removal:       null,                   // Cleanup duty — any airport
}

export function getDutiesForFlight(flightType) {
  return flightType === 'Departing' ? DEPARTING_DUTIES : ARRIVING_DUTIES
}

export function getDutyByKey(flightType, key) {
  return getDutiesForFlight(flightType).find(d => d.key === key) ?? null
}
