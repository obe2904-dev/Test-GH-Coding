// Fetch previous posts for learning patterns
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { PreviousPost } from '../types.ts'

export async function fetchPreviousPosts(
  userId: string,
  limit: number = 10
): Promise<PreviousPost[]> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log(`📝 Fetching previous posts for user: ${userId}`)

    // Fetch recent published posts from suggested_posts table
    const { data, error } = await supabase
      .from('suggested_posts')
      .select('id, post_content, platform, created_at, updated_at')
      .eq('user_id', userId)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('❌ Error fetching previous posts:', error)
      return []
    }

    if (!data || data.length === 0) {
      console.warn('⚠️ No previous posts found')
      return []
    }

    const posts: PreviousPost[] = data.map(post => ({
      id: post.id,
      content: typeof post.post_content === 'string' 
        ? post.post_content 
        : JSON.stringify(post.post_content),
      platform: post.platform || 'unknown',
      created_at: post.created_at
    }))

    console.log(`✅ Loaded ${posts.length} previous posts`)
    
    return posts

  } catch (error) {
    console.error('❌ Exception fetching previous posts:', error)
    return []
  }
}

export function formatPreviousPostsForPrompt(posts: PreviousPost[]): string {
  if (posts.length === 0) {
    return ''
  }

  const sections: string[] = ['\n=== PREVIOUS SUCCESSFUL POSTS ===']
  sections.push('Learn from these examples (tone, style, length):')
  
  for (let i = 0; i < Math.min(posts.length, 5); i++) {
    const post = posts[i]
    const content = post.content.substring(0, 200) // Truncate long posts
    sections.push(`\nExample ${i + 1}:`)
    sections.push(content)
  }

  return sections.join('\n')
}
