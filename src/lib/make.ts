// Make.com API Helper
// Handles communication with Make.com webhooks for AI workflows

const WEBHOOKS = {
  AI_GENERATE: import.meta.env.VITE_MAKE_WEBHOOK_AI_GENERATE,
  PUBLISH: import.meta.env.VITE_MAKE_WEBHOOK_PUBLISH,
  AI_IDEAS: import.meta.env.VITE_MAKE_WEBHOOK_AI_IDEAS,
}

export interface AIGenerateRequest {
  userId: string
  topic: string
  businessType?: string
  platforms: string[]
  userContext?: {
    website?: string
    recentPosts?: any[]
  }
}

export interface PublishPostRequest {
  postId: string
  userId: string
  platforms: string[]
  content: {
    headline?: string
    text: string
    hashtags?: string[]
  }
  media?: {
    url: string
    type: string
  }[]
  scheduledFor?: Date
}

export interface AIIdeasRequest {
  userId: string
  businessType: string
  tier: 'free' | 'standardPlus' | 'premium'
  userContext?: {
    location?: string
    recentPerformance?: any[]
  }
}

class MakeAPI {
  private async callWebhook(webhook: string | undefined, data: any) {
    if (!webhook || webhook.includes('YOUR_WEBHOOK_ID_HERE')) {
      console.warn('⚠️ Make.com webhook not configured')
      throw new Error('Make.com webhook not configured. Please add webhook URL to .env file.')
    }

    try {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`Make.com webhook failed: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Make.com API error:', error)
      throw error
    }
  }

  /**
   * Generate AI content variations based on a topic
   */
  async generateContent(request: AIGenerateRequest) {
    console.log('📤 Calling Make.com: AI Content Generation')
    return this.callWebhook(WEBHOOKS.AI_GENERATE, request)
  }

  /**
   * Publish post to social media platforms
   */
  async publishPost(request: PublishPostRequest) {
    console.log('📤 Calling Make.com: Publish Post')
    return this.callWebhook(WEBHOOKS.PUBLISH, request)
  }

  /**
   * Generate AI post ideas (for StandardPlus/Premium users)
   */
  async generateIdeas(request: AIIdeasRequest) {
    console.log('📤 Calling Make.com: Generate AI Ideas')
    return this.callWebhook(WEBHOOKS.AI_IDEAS, request)
  }

  /**
   * Check if Make.com is properly configured
   */
  isConfigured() {
    const allConfigured = Object.values(WEBHOOKS).every(
      webhook => webhook && !webhook.includes('YOUR_WEBHOOK_ID_HERE')
    )

    return {
      configured: allConfigured,
      webhooks: {
        aiGenerate: !!WEBHOOKS.AI_GENERATE && !WEBHOOKS.AI_GENERATE.includes('YOUR_WEBHOOK_ID_HERE'),
        publish: !!WEBHOOKS.PUBLISH && !WEBHOOKS.PUBLISH.includes('YOUR_WEBHOOK_ID_HERE'),
        aiIdeas: !!WEBHOOKS.AI_IDEAS && !WEBHOOKS.AI_IDEAS.includes('YOUR_WEBHOOK_ID_HERE'),
      }
    }
  }
}

export const makeAPI = new MakeAPI()

// Test Make.com configuration in development
if (import.meta.env.DEV) {
  const config = makeAPI.isConfigured()
  
  if (!config.configured) {
    console.warn('⚠️ Make.com not fully configured')
    console.log('Missing webhooks:', {
      'AI Generate': !config.webhooks.aiGenerate ? '❌' : '✅',
      'Publish': !config.webhooks.publish ? '❌' : '✅',
      'AI Ideas': !config.webhooks.aiIdeas ? '❌' : '✅',
    })
    console.log('\n📋 Setup instructions:')
    console.log('1. Go to https://www.make.com')
    console.log('2. Create a new scenario for each workflow')
    console.log('3. Add a Webhook module as the first step')
    console.log('4. Copy the webhook URL to your .env file')
  } else {
    console.log('✅ Make.com is configured')
  }
}
