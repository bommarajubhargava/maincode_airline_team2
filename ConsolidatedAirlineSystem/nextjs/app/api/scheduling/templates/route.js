import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth'
import { SHIFT_TEMPLATES, COVERAGE_RULES, CERT_LABELS, EMPLOYEE_CERTS } from '@/lib/scheduler'
import { mockUsers } from '@/lib/mockUsers'

/**
 * GET /api/scheduling/templates
 * Returns static scheduling config: templates, coverage rules, and employee certs.
 * Accessible by any authenticated user.
 */
export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  // Enrich COVERAGE_RULES with required cert labels
  const rules = COVERAGE_RULES.map(r => ({
    ...r,
    certLabels: r.certRequired.map(c => CERT_LABELS[c] ?? c),
  }))

  // Build per-user cert summary for schedulable staff
  const certsByUser = mockUsers
    .filter(u => ['Staff', 'Agent'].includes(u.role))
    .map(u => ({
      id:         u.id,
      name:       u.name,
      employeeId: u.employeeId,
      department: u.department,
      role:       u.role,
      certs:      EMPLOYEE_CERTS[u.id] ?? [],
      certLabels: (EMPLOYEE_CERTS[u.id] ?? []).map(c => CERT_LABELS[c] ?? c),
    }))

  return NextResponse.json({
    templates: SHIFT_TEMPLATES,
    rules,
    certLabels: CERT_LABELS,
    staff: certsByUser,
  })
}
