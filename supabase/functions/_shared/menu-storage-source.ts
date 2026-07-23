export const MENU_UPLOAD_BUCKET = 'menu-files'

export interface MenuStorageSource {
  bucket: string
  path: string
}

export function validateMenuStorageSource(
  businessId: string,
  bucketInput: unknown,
  pathInput: unknown,
): MenuStorageSource {
  if (bucketInput !== MENU_UPLOAD_BUCKET) {
    throw new Error('Invalid storage bucket')
  }
  if (typeof pathInput !== 'string' || !pathInput.trim()) {
    throw new Error('Missing storage path')
  }

  const path = pathInput.trim()
  const segments = path.split('/')
  if (
    path.startsWith('/') ||
    segments.some((segment) => !segment || segment === '.' || segment === '..') ||
    segments[0] !== businessId
  ) {
    throw new Error('Storage path does not belong to business')
  }

  return { bucket: MENU_UPLOAD_BUCKET, path }
}
