import { describe, expect, it } from 'vitest'
import {
  buildZeroRowAuditMessage,
  getAffectedRowCount,
  isPersistedSuggestionId,
} from '../src/lib/dailySuggestionIntegrity'
import {
  createSecurityAuditLog,
  isBusinessAccessDenied,
  redactIdentifier,
} from '../supabase/functions/get-quick-suggestions/security-audit'

describe('daily suggestion integrity helpers', () => {
  it('accepts only persisted positive integer IDs', () => {
    expect(isPersistedSuggestionId(1)).toBe(true)
    expect(isPersistedSuggestionId(42)).toBe(true)
    expect(isPersistedSuggestionId(0)).toBe(false)
    expect(isPersistedSuggestionId(-1)).toBe(false)
    expect(isPersistedSuggestionId(1.5)).toBe(false)
    expect(isPersistedSuggestionId('1')).toBe(false)
    expect(isPersistedSuggestionId(undefined)).toBe(false)
  })

  it('counts affected rows defensively', () => {
    expect(getAffectedRowCount([])).toBe(0)
    expect(getAffectedRowCount([{ id: 1 }])).toBe(1)
    expect(getAffectedRowCount({ id: 1 })).toBe(1)
    expect(getAffectedRowCount(null)).toBe(0)
    expect(getAffectedRowCount(undefined)).toBe(0)
  })

  it('formats zero-row audit message with redacted business id', () => {
    const msg = buildZeroRowAuditMessage('thumbs_up', '2037d63c-a138-4247-89c5-5b6b8cef9f3f', 123)
    expect(msg).toContain('zero-row scoped update (thumbs_up)')
    expect(msg).toContain('business=2037d63c...')
    expect(msg).toContain('suggestion=123')
  })
})

describe('security audit helpers', () => {
  it('redacts identifiers safely', () => {
    expect(redactIdentifier('2037d63c-a138-4247-89c5-5b6b8cef9f3f')).toBe('2037d63c...')
    expect(redactIdentifier('abc')).toBe('abc...')
    expect(redactIdentifier(undefined)).toBe('missing')
  })

  it('detects ownership denial conditions', () => {
    expect(isBusinessAccessDenied('owner', 'owner')).toBe(false)
    expect(isBusinessAccessDenied('owner', 'other')).toBe(true)
    expect(isBusinessAccessDenied(undefined, 'owner')).toBe(true)
    expect(isBusinessAccessDenied('owner', undefined)).toBe(true)
  })

  it('creates structured audit log payload', () => {
    const log = createSecurityAuditLog('access_denied', { businessId: '2037d63c...' })
    expect(log).toContain('access_denied')
    expect(log).toContain('businessId')
  })
})
