import { useMemo, useState, useEffect, useCallback } from 'react'
import type { TFunction } from 'i18next'
import { VALIDATION } from '../../../lib/constants'
import type { PhotoContent } from '../../../stores/postCreationStore'

interface PlatformTexts {
  [platform: string]: { headline: string; text: string }
}

export interface ValidationIssue {
  id: string
  message: string
}

interface UseGenerateValidationOptions {
  selectedPlatforms: string[]
  customizePerPlatform: boolean
  platformTexts: PlatformTexts
  text: string
  photoContent: PhotoContent | null
  t: TFunction
}

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram'
}

function formatPlatformLabel(platform: string): string {
  if (PLATFORM_LABELS[platform]) {
    return PLATFORM_LABELS[platform]
  }
  if (!platform) {
    return 'Platform'
  }
  return platform.charAt(0).toUpperCase() + platform.slice(1)
}

export function useGenerateValidation({
  selectedPlatforms,
  customizePerPlatform,
  platformTexts,
  text,
  photoContent,
  t
}: UseGenerateValidationOptions) {
  const [hasAttempted, setHasAttempted] = useState(false)

  const hasMediaAttachments = useMemo(() => {
    if (!photoContent?.uploadedMedia) {
      return false
    }
    return photoContent.uploadedMedia.length > 0
  }, [photoContent])

  const validationIssues = useMemo<ValidationIssue[]>(() => {
    const issues: ValidationIssue[] = []

    if (!selectedPlatforms || selectedPlatforms.length === 0) {
      issues.push({
        id: 'platforms',
        message: t('generate.selectPlatformError', 'Please select at least one platform')
      })
    }

    const effectivePlatforms = customizePerPlatform ? selectedPlatforms : [selectedPlatforms[0] ?? 'facebook']
    const contentTargets = effectivePlatforms.map((platform) => {
      const platformText = customizePerPlatform
        ? platformTexts[platform]?.text ?? ''
        : text
      return {
        id: platform,
        label: formatPlatformLabel(platform),
        text: (platformText ?? '').trim()
      }
    })

    if (!hasMediaAttachments) {
      const missingContent = contentTargets.filter((target) => target.text.length === 0)
      if (missingContent.length > 0) {
        if (customizePerPlatform) {
          const platformList = missingContent.map((target) => target.label).join(', ')
          issues.push({
            id: 'text-missing-platform',
            message: t('generate.missingPlatformText', 'Add text for {{platforms}} before continuing', {
              platforms: platformList
            })
          })
        } else {
          issues.push({
            id: 'text-missing',
            message: t('generate.completeTextError', 'Please complete headline and text')
          })
        }
      }
    }

    contentTargets.forEach((target) => {
      if (target.text.length > VALIDATION.post.maxLength) {
        issues.push({
          id: `text-too-long-${target.id}`,
          message: t('generate.postTooLong', 'Your text is too long. Keep it under {{max}} characters.', {
            max: VALIDATION.post.maxLength
          })
        })
      }
    })

    return issues
  }, [
    selectedPlatforms,
    customizePerPlatform,
    platformTexts,
    text,
    hasMediaAttachments,
    t
  ])

  const validateBeforeNext = useCallback(() => {
    if (validationIssues.length > 0) {
      setHasAttempted(true)
      return false
    }
    return true
  }, [validationIssues.length])

  useEffect(() => {
    if (hasAttempted && validationIssues.length === 0) {
      setHasAttempted(false)
    }
  }, [hasAttempted, validationIssues.length])

  const dismissValidation = useCallback(() => {
    setHasAttempted(false)
  }, [])

  const showValidation = hasAttempted && validationIssues.length > 0

  return {
    validationIssues,
    showValidation,
    validateBeforeNext,
    dismissValidation
  }
}
