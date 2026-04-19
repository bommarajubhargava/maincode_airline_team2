import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth'
import { SHIFT_TEMPLATES, COVERAGE_RULES, CERT_LABELS, EMPLOYEE_CERTS } from '@/lib/scheduler'
import { getEmployees, safeEmployee } from '@/lib/store'

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  const rules = COVERAGE_RULES.map(r => ({
    ...r,
    certLabels: r.certRequired.map(c => CERT_LABELS[c] ?? c),
  }))

  const allEmployees = await getEmployees()
  const certsByUser = allEmployees
    .filter(e => ['Staff', 'Agent'].includes(e.role))
    .map(e => {
      const safe = safeEmployee(e)
      return {
        id:         safe.id,
        name:       safe.name,
        employeeId: safe.employeeId,
        department: safe.department,
        role:       safe.role,
        certs:      EMPLOYEE_CERTS[safe.id] ?? [],
        certLabels: (EMPLOYEE_CERTS[safe.id] ?? []).map(c => CERT_LABELS[c] ?? c),
      }
    })

  return NextResponse.json({
    templates: SHIFT_TEMPLATES,
    rules,
    certLabels: CERT_LABELS,
    staff: certsByUser,
  })
}
