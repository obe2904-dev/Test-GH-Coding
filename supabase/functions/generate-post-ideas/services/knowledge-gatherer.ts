/**
 * Knowledge Gatherer Service
 * Gathers all relevant business knowledge for post generation
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface BusinessKnowledge {
  business: {
    name: string;
    type: string;
    city: string;
  };
  goals: Array<{
    id: string;
    description: string;
    priority: string;
    target_metric: any;
    time_constraints: any;
  }>;
  brand_profile: {
    brand_essence: string;
    tone_of_voice: any;
    content_hooks: any[];
    banned_words: string[];
  };
  location: {
    neighborhood: string;
    location_marketing_hooks: string[];
    landmarks_nearby: any[];
  };
  menu_metadata: {
    food_philosophy: string;
    signature_items_count: number;
    has_specialty_coffee: boolean;
  };
  operations: {
    opening_hours: any;
    typical_busy_periods: any[];
    typical_slow_periods: any[];
  };
  visual_identity: {
    photography_style: any;
    primary_colors: any[];
  };
}

export class KnowledgeGatherer {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
  }

  /**
   * Gather all knowledge for a business
   */
  async gatherKnowledge(businessId: string): Promise<BusinessKnowledge> {
    const [
      business,
      goals,
      brandProfile,
      location,
      menuMetadata,
      operations,
      visualIdentity
    ] = await Promise.all([
      this.getBasicInfo(businessId),
      this.getGoals(businessId),
      this.getBrandProfile(businessId),
      this.getLocationIntelligence(businessId),
      this.getMenuMetadata(businessId),
      this.getOperations(businessId),
      this.getVisualIdentity(businessId),
    ]);

    return {
      business,
      goals,
      brand_profile: brandProfile,
      location,
      menu_metadata: menuMetadata,
      operations,
      visual_identity: visualIdentity,
    };
  }

  private async getBasicInfo(businessId: string) {
    const { data } = await this.supabase
      .from('businesses')
      .select('business_name, business_type, city')
      .eq('id', businessId)
      .single();

    return {
      name: data?.business_name || 'Unknown',
      type: data?.business_type || 'restaurant',
      city: data?.city || 'Copenhagen',
    };
  }

  private async getGoals(businessId: string) {
    const { data } = await this.supabase
      .from('business_goals')
      .select('id, description, priority, target_metric, time_constraints, status, goal_type')
      .eq('business_id', businessId)
      .in('status', ['not_started', 'in_progress'])
      .order('priority', { ascending: true });

    return data || [];
  }

  private async getBrandProfile(businessId: string) {
    const { data } = await this.supabase
      .from('business_brand_profile')
      .select('brand_essence, tone_of_voice, content_hooks, banned_words')
      .eq('business_id', businessId)
      .single();

    return data || {
      brand_essence: '',
      tone_of_voice: {},
      content_hooks: [],
      banned_words: [],
    };
  }

  private async getLocationIntelligence(businessId: string) {
    const { data } = await this.supabase
      .from('business_location_intelligence')
      .select('neighborhood, location_marketing_hooks, landmarks_nearby')
      .eq('business_id', businessId)
      .single();

    return data || {
      neighborhood: '',
      location_marketing_hooks: [],
      landmarks_nearby: [],
    };
  }

  private async getMenuMetadata(businessId: string) {
    const { data } = await this.supabase
      .from('business_menu_metadata')
      .select('food_philosophy, signature_items_count, has_specialty_coffee')
      .eq('business_id', businessId)
      .single();

    return data || {
      food_philosophy: '',
      signature_items_count: 0,
      has_specialty_coffee: false,
    };
  }

  private async getOperations(businessId: string) {
    const { data } = await this.supabase
      .from('business_operations')
      .select('opening_hours, typical_busy_periods, typical_slow_periods')
      .eq('business_id', businessId)
      .single();

    return data || {
      opening_hours: {},
      typical_busy_periods: [],
      typical_slow_periods: [],
    };
  }

  private async getVisualIdentity(businessId: string) {
    const { data } = await this.supabase
      .from('business_visual_identity')
      .select('photography_style, primary_colors')
      .eq('business_id', businessId)
      .single();

    return data || {
      photography_style: {},
      primary_colors: [],
    };
  }
}
