import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { locationProfile } = await req.json();
    
    // Create Supabase client
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user's business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (businessError || !business) {
      return NextResponse.json({ error: 'No business found' }, { status: 404 });
    }
    
    // Save location profile to business_location_intelligence or brand_profiles
    // Option 1: Update existing location intelligence record
    const { error: updateError } = await supabase
      .from('business_location_intelligence')
      .upsert({
        business_id: business.id,
        address: locationProfile.address,
        latitude: locationProfile.coordinates.lat,
        longitude: locationProfile.coordinates.lng,
        primary_category: locationProfile.primaryCategory,
        secondary_categories: locationProfile.secondaryCategories,
        category_scores: locationProfile.categoryScores,
        content_strategy: locationProfile.contentStrategy,
        analyzed_at: locationProfile.lastAnalyzed,
        updated_at: new Date().toISOString()
      });
    
    if (updateError) {
      console.error('Failed to save location profile:', updateError);
      return NextResponse.json({ error: 'Failed to save location profile' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in location API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user's business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (businessError || !business) {
      return NextResponse.json({ error: 'No business found' }, { status: 404 });
    }
    
    // Fetch location profile
    const { data: locationProfile, error: fetchError } = await supabase
      .from('business_location_intelligence')
      .select('*')
      .eq('business_id', business.id)
      .single();
    
    if (fetchError) {
      return NextResponse.json({ error: 'Location profile not found' }, { status: 404 });
    }
    
    // Transform to LocationProfile format
    const profile = {
      address: locationProfile.address,
      coordinates: {
        lat: locationProfile.latitude,
        lng: locationProfile.longitude
      },
      primaryCategory: locationProfile.primary_category,
      secondaryCategories: locationProfile.secondary_categories || [],
      categoryScores: locationProfile.category_scores || {},
      contentStrategy: locationProfile.content_strategy || {},
      lastAnalyzed: locationProfile.analyzed_at
    };
    
    return NextResponse.json({ locationProfile: profile });
  } catch (error) {
    console.error('Error fetching location profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
