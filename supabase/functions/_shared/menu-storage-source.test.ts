import {
  MENU_UPLOAD_BUCKET,
  validateMenuStorageSource,
} from './menu-storage-source.ts'

Deno.test('accepts a menu-files path scoped to the business', () => {
  const source = validateMenuStorageSource(
    'business-123',
    MENU_UPLOAD_BUCKET,
    'business-123/file-id_menu.pdf',
  )

  if (source.bucket !== MENU_UPLOAD_BUCKET) throw new Error('Unexpected bucket')
  if (source.path !== 'business-123/file-id_menu.pdf') throw new Error('Unexpected path')
})

Deno.test('rejects another business path', () => {
  let rejected = false
  try {
    validateMenuStorageSource(
      'business-123',
      MENU_UPLOAD_BUCKET,
      'business-456/file-id_menu.pdf',
    )
  } catch {
    rejected = true
  }
  if (!rejected) throw new Error('Expected cross-business path to be rejected')
})

Deno.test('rejects traversal and non-menu buckets', () => {
  for (const [bucket, path] of [
    [MENU_UPLOAD_BUCKET, 'business-123/../business-456/menu.pdf'],
    ['other-bucket', 'business-123/menu.pdf'],
  ]) {
    let rejected = false
    try {
      validateMenuStorageSource('business-123', bucket, path)
    } catch {
      rejected = true
    }
    if (!rejected) throw new Error(`Expected ${bucket}/${path} to be rejected`)
  }
})
