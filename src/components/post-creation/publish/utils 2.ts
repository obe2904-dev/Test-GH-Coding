import type { PostContent } from '../../../stores/postCreationStore'

const LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram'
}

const sanitizeHashtag = (value: string) => value.replace(/^#+/, '').trim()

export const getPlatformLabel = (platform: string) => LABELS[platform] ?? platform

export const formatPlatformList = (platforms: string[]) =>
  platforms.map((platform) => getPlatformLabel(platform)).join(' & ')

export const normalizePlatformKey = (platform: string): string => {
  const normalized = platform.trim().toLowerCase()
  if (normalized.includes('facebook')) return 'facebook'
  if (normalized.includes('instagram')) return 'instagram'
  return normalized
}

export const buildPlatformPreviewContent = (
  postContent: PostContent | null,
  platform: string,
  selectedPlatforms: string[]
) => {
  if (!postContent) {
    return {
      headline: '',
      text: '',
      textWithHashtags: '',
      hashtags: [],
      includeHashtags: true
    }
  }

  const targetPlatform = normalizePlatformKey(platform)
  const normalizedSelections = selectedPlatforms
    .map((value) => normalizePlatformKey(value))
    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index)

  const fallbackPlatforms = normalizedSelections.length > 0 ? normalizedSelections : ['facebook']

  const platformContent = postContent.platformContent?.[targetPlatform]
  const headline = (platformContent?.headline ?? postContent.headline ?? '').trim()
  const baseText = (platformContent?.text ?? postContent.text ?? '').trim()
  const adjustments = platformContent?.adjustments ?? postContent.adjustments

  const platformSpecificView = postContent.platformHashtagViews?.[targetPlatform]

  const sourceHashtags = platformSpecificView
    ? platformSpecificView
    : postContent.platformSpecific
      ? platformContent?.hashtags ?? []
      : postContent.hashtags ?? []

  const hashtagsForPlatform = sourceHashtags.filter((tag) => {
    // treat empty platforms array the same as null (e.g. when platforms load after transfer)
    const effectivePlatforms = (tag.platforms && tag.platforms.length > 0) ? tag.platforms : fallbackPlatforms
    const platforms = effectivePlatforms.map((value) => normalizePlatformKey(value))
    return platforms.includes(targetPlatform)
  })

  const enabledHashtags = hashtagsForPlatform
    .filter((tag) => tag.enabled)
    .map((tag) => {
      const clean = sanitizeHashtag(tag.tag)
      return clean.length > 0 ? `#${clean}` : ''
    })
    .filter((tag) => tag.length > 1)

  const includeHashtags = adjustments?.includeHashtags ?? true

  const textWithHashtags = includeHashtags && enabledHashtags.length > 0
    ? (baseText.length > 0 ? `${baseText}\n\n${enabledHashtags.join(' ')}` : enabledHashtags.join(' '))
    : baseText

  return {
    headline,
    text: baseText,
    textWithHashtags,
    hashtags: hashtagsForPlatform,
    includeHashtags
  }
}
