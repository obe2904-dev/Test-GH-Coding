# AI Architecture Guide: Where to Code What

## 🎯 Overview

This guide explains where to implement different AI functionalities in your social media post creation system. The architecture follows a modular design pattern where individual AI features are orchestrated by a central composer.

## 🏗️ Architecture Pattern

```
Individual Features (src/features/*/index.ts)
    ↓ 
Orchestrator (PostComposerAI)
    ↓
React Hook (usePostComposer)
    ↓
UI Components (CreateStep)
```

## 📂 File Structure & Responsibilities

### 1. Individual AI Features (`src/features/*/index.ts`)

Each feature handles a specific AI capability with a consistent interface:

#### A) Content Generation (`src/features/idea/index.ts`)
**Purpose**: Generate headlines and main post text  
**Current**: Stub returning mock content  
**Code Here**:
```typescript
export async function generateIdea(ctx: GenerateContext): Promise<Out> {
  // Replace stub with:
  // - OpenAI API calls
  // - Custom ML model integration
  // - Supabase Edge Functions
  // - Template-based generation
  
  return {
    headline: "AI-generated headline",
    text: "AI-generated post content"
  }
}
```

#### B) Hashtag Research (`src/features/hashtags/index.ts`)
**Purpose**: Generate relevant and trending hashtags  
**Current**: Returns dummy hashtags  
**Code Here**:
```typescript
export async function generateHashtags(ctx: GenerateContext): Promise<string[]> {
  // Add AI logic for:
  // - Topic analysis from content
  // - Trending hashtag research
  // - Performance-based selection
  // - Platform-specific optimization
  
  return ["#relevant", "#trending", "#hashtags"]
}
```

#### C) Emoji Selection (`src/features/emojis/index.ts`)
**Purpose**: Context-aware emoji suggestions  
**Current**: Returns basic emoji set  
**Code Here**:
```typescript
export async function generateEmojis(ctx: GenerateContext): Promise<string[]> {
  // Implement:
  // - Sentiment analysis of text
  // - Business category mapping
  // - Cultural appropriateness
  // - Performance analytics
  
  return ["😊", "🎯", "✨"]
}
```

#### D) Call-to-Action (`src/features/cta/index.ts`)
**Purpose**: Generate compelling CTAs based on business goals  
**Current**: Basic CTA templates  
**Code Here**:
```typescript
export async function generateCtas(ctx: GenerateContext): Promise<string[]> {
  // Add intelligence for:
  // - Business intent detection
  // - Goal-based CTA selection
  // - Conversion optimization
  // - A/B testing insights
  
  return ["Visit our website", "Call now", "Shop today"]
}
```

#### E) Business Analysis (`src/features/BusinessProfilerAI/index.ts`)
**Purpose**: Extract business intelligence from websites/profiles  
**Current**: Mock business data  
**Code Here**:
```typescript
export async function analyzeBusinessProfile(ctx: BusinessProfileContext): Promise<BusinessProfileAnalysis> {
  // Implement:
  // - Web scraping
  // - Content analysis
  // - Competitor research
  // - Brand voice detection
  
  return {
    businessName: "Extracted name",
    businessType: "Detected category",
    // ... structured business data
  }
}
```

### 2. AI Orchestrator (`src/features/PostComposerAI/index.ts`)

**Purpose**: Coordinates all AI features intelligently  
**Code Here**:
```typescript
class PostComposerAI {
  async composePost(context: PostComposerContext): Promise<PostComposition> {
    // Add orchestration logic:
    // - Context enrichment
    // - Parallel AI execution
    // - Intelligent fallbacks
    // - Result optimization
    // - Performance prediction
  }
  
  private async enrichContext(context: PostComposerContext) {
    // Add business intelligence:
    // - Competitor analysis
    // - Audience insights
    // - Performance history
    // - Trending topics
  }
}
```

### 3. React Integration (`src/hooks/usePostComposer.ts`)

**Purpose**: React state management and UI integration  
**Code Here**:
```typescript
export function usePostComposer(options: UsePostComposerOptions) {
  const generateComposition = useCallback(async () => {
    // Add React-specific logic:
    // - Loading states
    // - Error handling
    // - Progress tracking
    // - Real-time updates
    // - Caching strategies
  }, [options])
  
  // Add features:
  // - Auto-save drafts
  // - Real-time collaboration
  // - Device optimization
  // - Offline support
}
```

### 4. API Services Layer (`src/api/ai-services.ts` - Create New)

**Purpose**: Centralized AI provider management  
**Code Here**:
```typescript
export class AIServices {
  static async callOpenAI(prompt: string, context: any) {
    // OpenAI integration with:
    // - Retry logic
    // - Cost optimization
    // - Model selection by tier
    // - Rate limiting
  }
  
  static async callSupabaseFunction(endpoint: string, payload: any) {
    // Supabase Edge Function calls
  }
  
  static async callCustomModel(modelName: string, input: any) {
    // Your custom ML models
  }
}
```

### 5. Performance Analytics (`src/features/PerformanceAI/index.ts` - Create New)

**Purpose**: Learn from post performance to improve suggestions  
**Code Here**:
```typescript
export async function analyzePostPerformance(posts: HistoricalPost[]) {
  // Implement:
  // - Pattern recognition
  // - Optimal timing analysis
  // - Element performance tracking
  // - Engagement prediction models
}
```

## 🚀 Development Priority

### Phase 1: Core Content (Week 1-2)
1. **Enhance `idea/index.ts`** - Replace with real AI text generation
2. **Improve `cta/index.ts`** - Add business intent detection

### Phase 2: Discovery (Week 3-4)
3. **Upgrade `hashtags/index.ts`** - Add trending research
4. **Enhance `emojis/index.ts`** - Add sentiment analysis

### Phase 3: Intelligence (Week 5-6)
5. **Implement `BusinessProfilerAI`** - Real web scraping + analysis
6. **Enhance `PostComposerAI`** - Smart orchestration

### Phase 4: Optimization (Week 7-8)
7. **Add `PerformanceAI`** - Learn from results
8. **Create `AIServices`** - Centralize providers

## 🎯 AI Flow Summary

```
User Input: "Weekend coffee special"
    ↓
Context Building: Platform, tone, preferences
    ↓
Individual AI Features (Parallel):
├── idea/index.ts → Generate headline + text
├── hashtags/index.ts → Find relevant tags
├── emojis/index.ts → Select appropriate emojis  
└── cta/index.ts → Create compelling CTAs
    ↓
PostComposerAI: Intelligent composition
    ↓
usePostComposer: React state management
    ↓
UI: Interactive suggestions + editing
```

## 💡 Key Benefits

- **Modular**: Each AI feature can be developed independently
- **Flexible**: Different AI providers for different features
- **Scalable**: Easy to add new AI capabilities
- **Testable**: Individual features can be unit tested
- **Cost-Effective**: Use expensive AI only where needed
- **Resilient**: Fallbacks when individual features fail

## 🔧 Implementation Tips

1. **Start Simple**: Replace one stub at a time
2. **Environment Variables**: Easy switching between AI providers
3. **Fallback Strategies**: Always have offline alternatives
4. **Caching**: Store AI results to reduce costs
5. **Monitoring**: Track usage and performance
6. **A/B Testing**: Experiment with different approaches

## 📊 Tier-Based Features

### Free Tier
- Basic AI from local stubs
- Limited suggestions (3 hashtags, 3 emojis)
- No trending data or performance insights

### Paid Tiers
- Advanced AI with multiple providers
- Enhanced with business profile data
- Trending analysis and performance prediction
- Unlimited suggestions and customization

---

*This architecture ensures your AI system is maintainable, scalable, and provides excellent user experience across all subscription tiers.*