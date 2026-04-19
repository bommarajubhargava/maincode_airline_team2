'use client'

const Section = ({ id, title, children }) => (
  <section id={id} className="mb-10 scroll-mt-20">
    <h2 className="text-xl font-bold text-blue-800 border-b-2 border-blue-100 pb-2 mb-4 print:text-black">{title}</h2>
    {children}
  </section>
)

const SubSection = ({ title, children }) => (
  <div className="mb-5">
    <h3 className="text-base font-semibold text-slate-700 mb-2">{title}</h3>
    {children}
  </div>
)

const Term = ({ term, def }) => (
  <div className="flex gap-3 mb-2">
    <span className="font-semibold text-slate-700 min-w-[160px] shrink-0">{term}</span>
    <span className="text-slate-600">{def}</span>
  </div>
)

const Step = ({ n, children }) => (
  <div className="flex gap-3 mb-2">
    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</span>
    <span className="text-slate-600">{children}</span>
  </div>
)

const RoleBadge = ({ role, color }) => (
  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{role}</span>
)

const TOC_ITEMS = [
  { id: 'overview',     label: 'System Overview' },
  { id: 'roles',        label: 'User Roles & Access' },
  { id: 'install',      label: 'Installing the App' },
  { id: 'login',        label: 'Logging In' },
  { id: 'staff',        label: 'Staff Dashboard' },
  { id: 'manager',      label: 'Manager Dashboard' },
  { id: 'admin',        label: 'Admin Dashboard' },
  { id: 'scheduling',   label: 'Scheduling Engine' },
  { id: 'flights',      label: 'Flight Duties' },
  { id: 'compliance',   label: 'Compliance & Violations' },
  { id: 'glossary',     label: 'Glossary of Terms' },
]

export default function DocsPage() {
  const handlePrint = () => window.print()

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 12px; }
          h2 { page-break-after: avoid; }
          section { page-break-inside: avoid; }
        }
      `}</style>

      {/* Header */}
      <div className="bg-blue-700 text-white px-6 py-8 print:py-4">
        <div className="max-w-5xl mx-auto flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">✈️</span>
              <div>
                <h1 className="text-2xl font-bold">SkyWave Air — Staff Portal</h1>
                <p className="text-blue-200 text-sm">User Guide & Technical Reference · v1.0 · April 2026</p>
              </div>
            </div>
            <p className="text-blue-100 text-sm max-w-2xl mt-2">
              Complete documentation covering system functionality, operational workflows, and technical terminology
              for all SkyWave Air ground operations staff.
            </p>
          </div>
          <div className="no-print flex flex-col gap-2 shrink-0">
            <button onClick={handlePrint}
              className="bg-white text-blue-700 font-semibold px-4 py-2 rounded-xl text-sm hover:bg-blue-50 transition-colors flex items-center gap-2">
              📄 Download PDF
            </button>
            <a href="/"
              className="bg-blue-600 border border-blue-400 text-white font-semibold px-4 py-2 rounded-xl text-sm hover:bg-blue-500 transition-colors flex items-center gap-2 text-center">
              ← Back to App
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 flex gap-8">

        {/* Sidebar TOC */}
        <aside className="no-print w-52 shrink-0">
          <div className="sticky top-6 bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Contents</p>
            <nav className="space-y-1">
              {TOC_ITEMS.map(item => (
                <a key={item.id} href={`#${item.id}`}
                  className="block text-sm text-slate-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors">
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">

          {/* ── OVERVIEW ── */}
          <Section id="overview" title="1. System Overview">
            <p className="text-slate-600 mb-3">
              SkyWave Air Staff Portal is a web-based workforce management system designed for ground operations
              across three Toronto-area airports: <strong>YYZ (Toronto Pearson International)</strong>,
              <strong> YTZ (Billy Bishop City)</strong>, and <strong>YHM (Hamilton International)</strong>.
            </p>
            <p className="text-slate-600 mb-4">
              The system manages staff scheduling, shift assignments, flight duty tracking, compliance monitoring,
              and roster management — replacing manual spreadsheets with a real-time, role-based platform
              accessible from any device including smartphones.
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { icon: '👥', title: 'Staff Management', desc: 'Track all employees, their shifts, roles, certifications and departments across all airports.' },
                { icon: '✈️', title: 'Flight Operations', desc: 'Monitor real-time flight duties, assign responsible staff, and track duty completion per flight.' },
                { icon: '📋', title: 'Smart Scheduling', desc: 'Auto-generate weekly rosters using coverage rules, rest requirements, and staff certifications.' },
              ].map(f => (
                <div key={f.title} className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-2xl mb-2">{f.icon}</p>
                  <p className="font-semibold text-slate-700 text-sm mb-1">{f.title}</p>
                  <p className="text-xs text-slate-500">{f.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ── ROLES ── */}
          <Section id="roles" title="2. User Roles & Access">
            <p className="text-slate-600 mb-4">The system has three access levels. Each role sees a tailored dashboard with relevant features only.</p>
            <div className="space-y-4">
              {[
                {
                  role: 'Admin', badge: 'bg-purple-100 text-purple-700', icon: '🛡️',
                  who: 'System administrator with full cross-airport visibility.',
                  can: ['View network-wide flight and staff statistics for all airports', 'Monitor duty completion rates per airport', 'Reseed the database to restore all default data', 'Access compliance and shift reports across all airports'],
                },
                {
                  role: 'Manager', badge: 'bg-blue-100 text-blue-700', icon: '👔',
                  who: 'Airport operations manager, scoped to their assigned airport.',
                  can: ['View and edit all shifts for their airport', 'Approve or reject shift change/swap/cancel requests', 'Generate, review, and publish staff rosters', 'Monitor flight duties and assign responsible staff', 'View compliance violations for their team'],
                },
                {
                  role: 'Agent', badge: 'bg-sky-100 text-sky-700', icon: '🧑‍✈️',
                  who: 'Ground operations staff member (check-in, security, ramp, catering, gate etc.).',
                  can: ['View personal shift calendar and upcoming schedule', 'See colleagues on duty each day', 'Submit requests to change, cancel, or swap shifts', 'View and complete assigned flight duties'],
                },
              ].map(r => (
                <div key={r.role} className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{r.icon}</span>
                    <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${r.badge}`}>{r.role}</span>
                    <span className="text-sm text-slate-500">{r.who}</span>
                  </div>
                  <ul className="space-y-1 pl-2">
                    {r.can.map((c, i) => <li key={i} className="text-sm text-slate-600 flex gap-2"><span className="text-blue-400">•</span>{c}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          {/* ── INSTALL ── */}
          <Section id="install" title="3. Installing the App on Your Phone">
            <p className="text-slate-600 mb-4">
              SkyWave Air is a <strong>Progressive Web App (PWA)</strong> — you can install it directly from your browser
              without going through an app store. It works on iPhone, Android, and desktop.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="font-semibold text-slate-700 mb-3 flex items-center gap-2">🍎 iPhone / iPad (Safari)</p>
                <Step n="1">Open the app URL in <strong>Safari</strong> (must be Safari, not Chrome)</Step>
                <Step n="2">Tap the <strong>Share</strong> button at the bottom of the screen (box with arrow)</Step>
                <Step n="3">Scroll down and tap <strong>"Add to Home Screen"</strong></Step>
                <Step n="4">Tap <strong>Add</strong> — the SkyWave Air icon appears on your home screen</Step>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="font-semibold text-slate-700 mb-3 flex items-center gap-2">🤖 Android (Chrome)</p>
                <Step n="1">Open the app URL in <strong>Chrome</strong></Step>
                <Step n="2">Tap the <strong>three-dot menu</strong> (⋮) in the top-right corner</Step>
                <Step n="3">Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></Step>
                <Step n="4">Tap <strong>Install</strong> — the app installs like a native app</Step>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              Once installed, the app launches in full-screen mode with no browser address bar, just like a native app.
              An internet connection is required for live data.
            </p>
          </Section>

          {/* ── LOGIN ── */}
          <Section id="login" title="4. Logging In">
            <p className="text-slate-600 mb-3">
              All staff log in using their work email address and a shared password provided by their manager.
            </p>
            <SubSection title="Login Process">
              <Step n="1">Navigate to the SkyWave Air portal URL</Step>
              <Step n="2">Enter your work email (e.g. <code className="bg-slate-100 px-1 rounded text-xs">agent1.yyz@skystaff.com</code>)</Step>
              <Step n="3">Enter your password (default: <code className="bg-slate-100 px-1 rounded text-xs">1234</code>)</Step>
              <Step n="4">You are redirected to your role-specific dashboard automatically</Step>
            </SubSection>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <strong>Security note:</strong> Your session is stored as an encrypted token in your browser cookie.
              Always sign out when using a shared device. Sessions expire automatically after inactivity.
            </div>
          </Section>

          {/* ── STAFF ── */}
          <Section id="staff" title="5. Staff Dashboard (Agent View)">
            <p className="text-slate-600 mb-4">
              Agents see a personal dashboard showing their upcoming shifts, calendar, and request management.
            </p>
            <SubSection title="Show Next Duration">
              <p className="text-slate-600 text-sm mb-2">
                The <strong>"Show next"</strong> dropdown (7 / 14 / 30 / 60 / 90 days) controls how far ahead the system fetches
                your shifts. The calendar and shifts list both update when you change this value.
              </p>
            </SubSection>
            <SubSection title="Calendar Tab">
              <p className="text-slate-600 text-sm mb-2">
                Shows a monthly calendar with colour-coded shift indicators. Click any day to see a popup with all
                staff scheduled that day and their shift details. Click a shift chip to open full shift details.
              </p>
              <p className="text-slate-600 text-sm">
                If your shifts are in a future month, the calendar auto-navigates to that month.
                Use the <strong>month jump strip</strong> at the top to quickly switch between months that have shifts.
              </p>
            </SubSection>
            <SubSection title="Shifts List Tab">
              <p className="text-slate-600 text-sm">
                A list of all your upcoming shifts in chronological order. Click any shift card to open details
                and submit action requests (cancel, change, or swap).
              </p>
            </SubSection>
            <SubSection title="Shift Action Requests">
              <p className="text-slate-600 text-sm mb-2">From any shift detail view, you can submit:</p>
              <div className="space-y-1.5 text-sm text-slate-600 pl-2">
                <p><strong className="text-red-600">🚫 Cancel</strong> — Request to cancel a scheduled shift. Requires manager approval.</p>
                <p><strong className="text-blue-600">✏️ Change</strong> — Request a time or date change. State your reason and preferred new time.</p>
                <p><strong className="text-indigo-600">🔄 Swap</strong> — Request to swap your shift with a colleague. Manager reviews and approves.</p>
              </div>
            </SubSection>
          </Section>

          {/* ── MANAGER ── */}
          <Section id="manager" title="6. Manager Dashboard">
            <p className="text-slate-600 mb-4">
              Managers have a multi-tab dashboard scoped to their assigned airport. They can see all staff shifts,
              handle requests, monitor compliance, and manage flight duties.
            </p>
            <SubSection title="All Shifts Tab">
              <p className="text-slate-600 text-sm mb-2">
                Displays all shifts for the manager's airport. Use the filter panel to narrow results by employee,
                date range, shift type, or status. Set your filters and click <strong>Search</strong> to apply.
                The result shows <em>"N shifts (filtered from X total)"</em> so you always know the full dataset size.
              </p>
              <p className="text-slate-600 text-sm">
                Click the <strong>✏️ pencil icon</strong> on any shift card to edit start/end time, location, type, or status directly.
              </p>
            </SubSection>
            <SubSection title="Requests Tab">
              <p className="text-slate-600 text-sm">
                Shows all pending, approved, and rejected shift requests from staff. Managers can approve or reject
                each request with one click. Pending requests show a red badge count on the tab.
              </p>
            </SubSection>
            <SubSection title="Staff List Tab">
              <p className="text-slate-600 text-sm">
                A full table of all employees at the airport, showing their ID, email, role, department, and
                number of shifts assigned.
              </p>
            </SubSection>
            <SubSection title="Compliance Tab">
              <p className="text-slate-600 text-sm">
                Runs a compliance check across all staff, flagging violations of rest period rules, maximum
                daily/weekly hours, consecutive working days, and missing certifications. Critical violations
                are shown in red; warnings in amber.
              </p>
            </SubSection>
            <SubSection title="Flights Today Tab">
              <p className="text-slate-600 text-sm">
                Shows all departing and arriving flights for today with real-time duty completion status.
                Each flight card lists every required duty and which staff member is responsible.
              </p>
            </SubSection>
            <SubSection title="Scheduling Tab">
              <p className="text-slate-600 text-sm">
                The AI-powered roster engine. See Section 8 for full details.
              </p>
            </SubSection>
          </Section>

          {/* ── ADMIN ── */}
          <Section id="admin" title="7. Admin Dashboard">
            <p className="text-slate-600 mb-3">
              The Admin dashboard provides a network-wide view across all three airports.
            </p>
            <SubSection title="Network Stats">
              <p className="text-slate-600 text-sm">
                At-a-glance totals for flights, completed flights, total duties, duties completed, and staff on duty —
                aggregated across YYZ, YTZ, and YHM for any selected date.
              </p>
            </SubSection>
            <SubSection title="Per-Airport Cards">
              <p className="text-slate-600 text-sm">
                Each airport has its own card showing: duty completion percentage, flights done vs total,
                staff on duty with their shift type, and an operations breakdown by duty type.
              </p>
            </SubSection>
            <SubSection title="Reseed Database">
              <p className="text-slate-600 text-sm">
                The <strong>↺ Reseed DB</strong> button wipes all data and restores the full default dataset —
                all 60 employees, flights, and seeded shifts. Use this to reset the system to a clean demo state.
                <strong className="text-red-600"> This action cannot be undone.</strong>
              </p>
            </SubSection>
          </Section>

          {/* ── SCHEDULING ── */}
          <Section id="scheduling" title="8. Scheduling Engine">
            <p className="text-slate-600 mb-4">
              The scheduling engine automatically generates compliant weekly rosters based on coverage rules,
              staff certifications, and labour regulations.
            </p>
            <SubSection title="Generating a Roster">
              <Step n="1">Go to Manager Dashboard → <strong>Scheduling</strong> tab</Step>
              <Step n="2">Enter a roster name, start date, and end date</Step>
              <Step n="3">Click <strong>Generate Preview</strong> — the engine assigns shifts to all qualified staff</Step>
              <Step n="4">Review the <strong>Roster Grid</strong> (staff × day matrix) and <strong>Conflicts</strong> tab</Step>
              <Step n="5">If satisfied, click <strong>Save as Draft</strong> to store the roster</Step>
            </SubSection>
            <SubSection title="Publishing a Roster">
              <p className="text-slate-600 text-sm mb-2">
                Publishing a roster adds all its shifts to the <strong>live schedule</strong> — staff can immediately
                see the new shifts in their dashboard and calendar.
              </p>
              <Step n="1">Go to <strong>Saved Rosters</strong> sub-tab and find your draft roster</Step>
              <Step n="2">Click <strong>Publish</strong> — a confirmation modal appears showing roster details</Step>
              <Step n="3">If there are critical conflicts, a force-publish warning is shown with conflict counts</Step>
              <Step n="4">Click <strong>Publish Roster</strong> (or <strong>Force Publish</strong> to override warnings)</Step>
            </SubSection>
            <SubSection title="Coverage Rules">
              <p className="text-slate-600 text-sm">
                Coverage rules define the minimum staffing requirements per shift slot. Each rule specifies:
                the team (e.g. Ramp GSE, Security), shift types covered (Morning/Afternoon/Night),
                minimum staff count, required certifications, and physical location.
                The engine only assigns staff who hold the required certifications for each role.
              </p>
            </SubSection>
            <SubSection title="Conflict Types">
              <div className="space-y-1.5 text-sm">
                <Term term="Coverage Gap" def="A required shift slot has no qualified staff available to fill it." />
                <Term term="Insufficient Rest" def="Staff has less than the required rest period between consecutive shifts." />
                <Term term="Consecutive Days" def="Staff is scheduled for more days in a row than the maximum allowed." />
                <Term term="Daily Hours Exceeded" def="Total hours in a single day exceeds the regulatory maximum." />
                <Term term="Weekly Hours Exceeded" def="Total hours in a rolling 7-day window exceeds the maximum." />
                <Term term="Fatigue Threshold" def="Rolling 14-day hours exceed the fatigue safety limit." />
                <Term term="Missing Certification" def="Staff assigned to a duty they are not certified to perform." />
              </div>
            </SubSection>
          </Section>

          {/* ── FLIGHTS ── */}
          <Section id="flights" title="9. Flight Duties">
            <p className="text-slate-600 mb-3">
              Each flight has a set of required ground duties that must be completed before departure or after arrival.
              The system tracks completion status in real time.
            </p>
            <SubSection title="Duty Types">
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                {[
                  ['⛽ Fueling',           'Refuelling the aircraft to the required fuel load before departure.'],
                  ['🧳 Baggage Load',       'Loading passenger and cargo bags into the aircraft hold.'],
                  ['🧳 Baggage Unload',     'Unloading bags from arriving aircraft and delivering to reclaim.'],
                  ['🔍 Aircraft Inspection','Pre-flight or post-flight safety and condition check of the aircraft exterior.'],
                  ['🍽️ Catering Load',      'Loading pre-prepared meals, beverages, and supplies onto the aircraft.'],
                  ['🧹 Cabin Clean Dep.',   'Full cabin cleaning before passenger boarding for departure.'],
                  ['🧹 Cabin Clean Arr.',   'Quick cabin clean after disembarkation for turnaround.'],
                  ['🔒 Security Check',     'Security screening of aircraft, hold, and cabin before boarding.'],
                  ['🚶 Pax Boarding',       'Managing the passenger boarding process at the gate.'],
                  ['🚶 Disembarkation',     'Managing the passenger disembarkation process from the aircraft.'],
                  ['📋 Safety Briefing',    'Conducting the pre-departure staff safety and emergency briefing.'],
                  ['🗑️ Waste Removal',      'Removing waste and used catering items from the aircraft.'],
                ].map(([duty, desc]) => (
                  <div key={duty} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                    <p className="font-semibold text-slate-700 text-xs">{duty}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
            </SubSection>
            <SubSection title="Responsible Staff">
              <p className="text-slate-600 text-sm">
                Each duty is automatically linked to the team responsible based on coverage rules.
                For example, fueling and baggage duties are assigned to the Ramp GSE team at Runway Control,
                while security checks are assigned to Security staff at the Security Checkpoint.
                Managers can see exactly which staff member is responsible for each duty on each flight.
              </p>
            </SubSection>
          </Section>

          {/* ── COMPLIANCE ── */}
          <Section id="compliance" title="10. Compliance & Violations">
            <p className="text-slate-600 mb-3">
              The compliance engine continuously monitors scheduling data against aviation labour regulations
              and flags any violations for manager review.
            </p>
            <SubSection title="Severity Levels">
              <div className="flex gap-4 mb-3">
                <div className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span><strong className="text-red-600">Critical</strong> — Must be resolved before publishing the roster or the shift goes live.</div>
                <div className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span><strong className="text-amber-600">Warning</strong> — Should be reviewed but does not block publishing.</div>
              </div>
            </SubSection>
            <SubSection title="Regulatory Limits Enforced">
              <div className="space-y-1.5">
                <Term term="Max daily hours" def="No staff member may be scheduled more than 12 hours in a single day." />
                <Term term="Min rest period" def="At least 10 hours rest is required between the end of one shift and the start of the next." />
                <Term term="Max consecutive days" def="Staff may not work more than 6 consecutive days without a day off." />
                <Term term="Max weekly hours" def="Total scheduled hours in any 7-day rolling window must not exceed 48 hours." />
                <Term term="Fatigue rolling window" def="Total hours across any 14-day period must not exceed 72 hours." />
              </div>
            </SubSection>
          </Section>

          {/* ── GLOSSARY ── */}
          <Section id="glossary" title="11. Glossary of Terms">
            <div className="space-y-2">
              {[
                ['Airport Code (IATA)',  'Three-letter code identifying an airport. YYZ = Toronto Pearson, YTZ = Billy Bishop, YHM = Hamilton.'],
                ['Agent',               'A frontline ground operations staff member. May work in check-in, security, ramp, catering, or gate operations.'],
                ['Airside',             'The secure area of an airport beyond the security checkpoint, where aircraft park and ground operations occur.'],
                ['Catering',            'Preparation and loading of in-flight meals, beverages, and supplies onto the aircraft.'],
                ['Certification',       'A qualification that authorises an employee to perform specific duties (e.g. airside-vehicle, security-screening, dangerous-goods).'],
                ['Compliance',          'Adherence to aviation labour regulations governing working hours, rest periods, and staff qualifications.'],
                ['Coverage Rule',       'A policy defining the minimum number of qualified staff required at a specific location during a specific shift type.'],
                ['Duty',                'A specific task assigned to a staff member as part of ground handling a flight (e.g. fueling, baggage load, security check).'],
                ['Duty Key',            'Internal system identifier for a specific flight duty type (e.g. baggage_load, security_check).'],
                ['Flight Type',         'Whether a flight is Departing (leaving the airport) or Arriving (landing at the airport). Each type has different duty requirements.'],
                ['Force Publish',       'Publishing a roster despite unresolved critical conflicts. Used when a manager has manually reviewed and accepted the risk.'],
                ['GSE',                 'Ground Support Equipment — vehicles and machinery used to service aircraft on the apron (e.g. baggage carts, fuel trucks, pushback tugs).'],
                ['Ground Handling',     'All services provided to an aircraft while it is on the ground, including fueling, catering, cleaning, baggage, and security.'],
                ['Manager',             'An airport operations manager responsible for a single airport\'s staffing, scheduling, and compliance.'],
                ['PWA',                 'Progressive Web App — a web application that can be installed on a mobile device\'s home screen and used like a native app.'],
                ['Ramp',                'The apron area where aircraft park. Ramp staff handle aircraft positioning, fueling, and baggage.'],
                ['Roster',              'A schedule document assigning specific shifts to specific staff members over a defined period (typically one week).'],
                ['Shift',               'A defined work period for an employee, with a start time, end time, location, and type (Morning, Afternoon, Night).'],
                ['Shift Swap',          'An arrangement where two employees exchange their scheduled shifts, subject to manager approval.'],
                ['Shift Type',          'Classification of a shift by time of day: Morning (06:00–14:00), Afternoon (10:00–18:00), Night (18:00–02:00).'],
                ['Turso',               'The cloud database (serverless SQLite) used to store all system data, accessible from both local development and production.'],
                ['Vercel',              'The cloud hosting platform where the production version of SkyWave Air is deployed.'],
              ].map(([term, def]) => (
                <div key={term} className="flex gap-3 py-2 border-b border-slate-100">
                  <span className="font-semibold text-slate-700 text-sm min-w-[180px] shrink-0">{term}</span>
                  <span className="text-slate-600 text-sm">{def}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Footer */}
          <div className="mt-10 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
            <p>SkyWave Air Staff Portal · User Guide v1.0 · April 2026</p>
            <p className="mt-1">For technical support, contact your system administrator.</p>
          </div>

        </main>
      </div>
    </div>
  )
}
