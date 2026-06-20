/**
 * MediaUploadZone Component
 * 
 * Drag-and-drop upload area with:
 * - File input fallback
 * - Drag-over visual feedback
 * - File type validation
 * - Upload progress
 * - Quota check before upload
 */

import { useRef, useState, useCallback } from 'react'
import type { PostType, StorageQuota } from '../../../api/mediaLibrary'

interface MediaUploadZoneProps {
  businessId: string
  onUploadStart?: () => void
  onUploadComplete?: () => void
  onUploadError?: (error: Error) => void
  accept?: string
  maxSizeMB?: number
  defaultPostType?: PostType
  className?: string
  quota?: StorageQuota | null // Optional quota prop for checking limits
}

export function MediaUploadZone({
  businessId: _businessId,
  onUploadStart,
  onUploadComplete,
  onUploadError,
  accept = 'image/jpeg,image/png,image/webp,video/mp4,video/webm',
  maxSizeMB = 10,
  defaultPostType: _defaultPostType,
  className = '',
  quota,
}: MediaUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const validateFile = (file: File): boolean => {
    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      onUploadError?.(new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds ${maxSizeMB}MB limit`))
      return false
    }

    // Check file type
    const acceptedTypes = accept.split(',').map(t => t.trim())
    if (!acceptedTypes.some(type => file.type === type || type === `${file.type.split('/')[0]}/*`)) {
      onUploadError?.(new Error(`File type ${file.type} not accepted. Allowed: ${accept}`))
      return false
    }

    return true
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
// Check quota before upload
    if (quota?.isOverLimit) {
      const errorMsg = 'Storage full! Delete old media or upgrade your plan.'
      onUploadError?.(new Error(errorMsg))
      return
    }

    if (quota?.isNearLimit && quota.percentUsed >= 90) {
      // Show warning but allow upload
      console.warn(`Storage ${quota.percentUsed.toFixed(0)}% full (${quota.usedMB}MB / ${quota.limitMB}MB)`)
    }

    
    const file = files[0] // Single file upload for now

    if (!validateFile(file)) {
      return
    }

    setIsUploading(true)
    onUploadStart?.()

    try {
      // Note: Uncomment this when integrating in Phase 4
      // Will need businessId from auth context or props
      // const { uploadToMediaLibrary } = await import('../../../api/mediaLibrary')
      // const media = await uploadToMediaLibrary({
      //   file,
      //   businessId,
      //   postType: defaultPostType,
      // })
      
      // Temporary: Simulate upload for UI testing
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      onUploadComplete?.()
    } catch (error) {
      console.error('Upload failed:', error)
      onUploadError?.(error as Error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    handleFiles(files)
  }, [])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div
      className={`relative ${className}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInputChange}
        className="hidden"
      />

      <div
        onClick={handleClick}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50'
        } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="text-sm text-gray-600">Uploading...</p>
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              <svg
                className={`w-12 h-12 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">
              {isDragging ? 'Drop file here' : 'Drag & drop or click to upload'}
            </p>
            <p className="text-xs text-gray-500">
              Images (JPG, PNG, WebP) or Videos (MP4, WebM)
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Max size: {maxSizeMB}MB
            </p>
          </>
        )}
      </div>
    </div>
  )
}
