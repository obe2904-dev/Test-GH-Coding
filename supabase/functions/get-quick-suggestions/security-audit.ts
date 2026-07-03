export function redactIdentifier(value: string | null | undefined): string {
  if (!value) return 'missing'
  const trimmed = value.trim()
  if (trimmed.length <= 8) return `${trimmed}...`
  return `${trimmed.slice(0, 8)}...`
}

export function createSecurityAuditLog(event: string, details: Record<string, unknown>): string {
  return JSON.stringify({ event, ...details })
}

export function isBusinessAccessDenied(ownerId: string | null | undefined, userId: string | null | undefined): boolean {
  return !ownerId || !userId || ownerId !== userId
}
