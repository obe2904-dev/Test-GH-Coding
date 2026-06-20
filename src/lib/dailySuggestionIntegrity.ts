export function isPersistedSuggestionId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

export function getAffectedRowCount(data: unknown): number {
  if (Array.isArray(data)) return data.length
  if (data && typeof data === 'object') return 1
  return 0
}

export function buildZeroRowAuditMessage(operation: string, businessId: string | null | undefined, suggestionId: number): string {
  const scopedBusiness = businessId ? `${businessId.slice(0, 8)}...` : 'missing'
  return `[daily_suggestions] zero-row scoped update (${operation}) | business=${scopedBusiness} suggestion=${suggestionId}`
}
