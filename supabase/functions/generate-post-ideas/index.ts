/**
 * Generate Post Ideas
 * Creates intelligent, goal-driven social media posts
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { KnowledgeGatherer } from './services/knowledge-gatherer.ts';
import { GoalAnalyzer } from './services/goal-analyzer.ts';
import { PostGenerator } from './services/post-generator.ts';
import { Scheduler } from './services/scheduler.ts';

interface GeneratePostsRequest {
  business_id: string;
  number_of_posts?: number; // Smart: 3, Pro: 5+
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { business_id, number_of_posts = 3 } = await req.json() as GeneratePostsRequest;

    if (!business_id) {
      return new Response(
        JSON.stringify({ error: 'business_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[1/5] Gathering business knowledge...`);
    const gatherer = new KnowledgeGatherer(supabase);
    const knowledge = await gatherer.gatherKnowledge(business_id);

    console.log(`[2/5] Analyzing goals...`);
    const goalAnalyzer = new GoalAnalyzer();
    const topGoal = goalAnalyzer.getTopGoal(knowledge.goals);

    if (!topGoal) {
      return new Response(
        JSON.stringify({ 
          error: 'No active goals found',
          suggestion: 'Create at least one business goal to generate targeted posts'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[3/5] Generating ${number_of_posts} post ideas with GPT-4o...`);
    const generator = new PostGenerator(openaiApiKey);
    const postIdeas = await generator.generatePosts(knowledge, number_of_posts);

    console.log(`[4/5] Optimizing posting schedule...`);
    const scheduler = new Scheduler();
    
    // Add suggested times to posts
    postIdeas.forEach((post, index) => {
      if (!post.suggested_post_time) {
        const baseTime = scheduler.suggestPostingTime(topGoal, knowledge.operations);
        // Space out posts by 1-2 days
        baseTime.setDate(baseTime.getDate() + (index * 2));
        post.suggested_post_time = baseTime.toISOString();
      }
    });

    console.log(`[5/5] Saving post ideas to database...`);
    const { data: savedPosts, error: saveError } = await supabase
      .from('post_ideas')
      .insert(
        postIdeas.map(post => ({
          business_id,
          caption: post.caption,
          hashtags: post.hashtags,
          platform: post.platform,
          suggested_post_time: post.suggested_post_time,
          content_type: post.content_type,
          visual_suggestions: post.visual_suggestions,
          aligned_goal_id: post.aligned_goal_id,
          goal_description: post.goal_description,
          status: 'draft',
        }))
      )
      .select();

    if (saveError) {
      throw new Error(`Failed to save posts: ${saveError.message}`);
    }

    console.log('✅ Post ideas generated successfully!');

    return new Response(
      JSON.stringify({
        success: true,
        posts: savedPosts,
        summary: {
          posts_generated: postIdeas.length,
          primary_goal: topGoal.description,
          goal_priority: topGoal.priority,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating post ideas:', error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
