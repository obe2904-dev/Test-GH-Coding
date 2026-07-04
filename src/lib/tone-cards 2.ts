/**
 * Tone Cards - Category-specific tone guidelines
 * Client-side version for frontend use
 */

export interface ToneCard {
  category: string
  tone: string
  characteristics: string[]
  voiceGuidelines: string
}

export const TONE_CARDS: Record<string, ToneCard> = {
  // Food & Beverage
  'Café': {
    category: 'Café',
    tone: 'Casual, cozy, relaxed, and comfortable',
    characteristics: [
      'Warm and welcoming',
      'Community-focused',
      'Approachable and friendly',
      'Emphasis on atmosphere and experience'
    ],
    voiceGuidelines: 'Use conversational language that makes customers feel at home. Focus on comfort, quality, and the social experience.'
  },
  'Restaurant': {
    category: 'Restaurant',
    tone: 'Inviting, appetizing, and professional',
    characteristics: [
      'Emphasizes quality and taste',
      'Sophisticated yet accessible',
      'Detail-oriented about cuisine',
      'Creates anticipation'
    ],
    voiceGuidelines: 'Balance professionalism with warmth. Highlight culinary expertise while remaining welcoming.'
  },
  'Bageri': {
    category: 'Bageri',
    tone: 'Fresh, warm, traditional, and comforting',
    characteristics: [
      'Artisanal and authentic',
      'Early morning energy',
      'Focus on freshness and craftsmanship',
      'Nostalgic and homey'
    ],
    voiceGuidelines: 'Emphasize freshness, tradition, and the sensory experience of baking.'
  },
  'Bar': {
    category: 'Bar',
    tone: 'Lively, social, energetic, and fun',
    characteristics: [
      'Vibrant and engaging',
      'Social and community-building',
      'Celebratory atmosphere',
      'Relaxed and entertaining'
    ],
    voiceGuidelines: 'Create excitement around social experiences. Be approachable and fun without being unprofessional.'
  },

  // Health & Wellness
  'Frisør': {
    category: 'Frisør',
    tone: 'Professional, creative, personal, and caring',
    characteristics: [
      'Style-conscious',
      'Personal attention',
      'Expertise in beauty',
      'Confidence-building'
    ],
    voiceGuidelines: 'Balance creativity with professionalism. Make clients feel valued and beautiful.'
  },
  'Skønhedsklinik': {
    category: 'Skønhedsklinik',
    tone: 'Professional, soothing, trustworthy, and refined',
    characteristics: [
      'Expert and credible',
      'Calm and reassuring',
      'Focus on results and care',
      'Pro but accessible'
    ],
    voiceGuidelines: 'Project expertise and trustworthiness. Emphasize care, quality, and transformation.'
  },
  'Spa': {
    category: 'Spa',
    tone: 'Tranquil, luxurious, peaceful, and rejuvenating',
    characteristics: [
      'Calm and serene',
      'Focus on wellness and relaxation',
      'Pro experience',
      'Self-care oriented'
    ],
    voiceGuidelines: 'Use calming language that evokes relaxation. Emphasize escape, rejuvenation, and self-care.'
  },
  'Fitness': {
    category: 'Fitness',
    tone: 'Motivating, energetic, supportive, and empowering',
    characteristics: [
      'Goal-oriented',
      'Encouraging and positive',
      'Community-focused',
      'Results-driven'
    ],
    voiceGuidelines: 'Be motivational without being pushy. Emphasize progress, community, and personal achievement.'
  },
  'Yoga': {
    category: 'Yoga',
    tone: 'Peaceful, mindful, balanced, and welcoming',
    characteristics: [
      'Holistic and centered',
      'Inclusive and accepting',
      'Focus on mind-body connection',
      'Gentle and encouraging'
    ],
    voiceGuidelines: 'Use mindful, inclusive language. Emphasize balance, wellness, and personal journey.'
  },

  // Retail
  'Tøjbutik': {
    category: 'Tøjbutik',
    tone: 'Stylish, trendy, confident, and personal',
    characteristics: [
      'Fashion-forward',
      'Personal styling focus',
      'Expressive and creative',
      'Customer empowerment'
    ],
    voiceGuidelines: 'Be style-conscious and inspiring. Help customers feel confident and fashionable.'
  },
  'Butik': {
    category: 'Butik',
    tone: 'Friendly, helpful, personal, and reliable',
    characteristics: [
      'Customer service focused',
      'Knowledgeable and helpful',
      'Local and personal',
      'Trustworthy'
    ],
    voiceGuidelines: 'Be approachable and helpful. Emphasize personal service and local connection.'
  },
  'Boghandel': {
    category: 'Boghandel',
    tone: 'Thoughtful, literary, welcoming, and knowledgeable',
    characteristics: [
      'Cultured and educated',
      'Passionate about books',
      'Community-oriented',
      'Thoughtful recommendations'
    ],
    voiceGuidelines: 'Show passion for literature and reading. Be knowledgeable without being pretentious.'
  },

  // Professional Services
  'Advokat': {
    category: 'Advokat',
    tone: 'Professional, trustworthy, clear, and authoritative',
    characteristics: [
      'Expert and credible',
      'Clear communication',
      'Client-focused',
      'Ethical and reliable'
    ],
    voiceGuidelines: 'Project expertise and trustworthiness. Be clear and professional while remaining approachable.'
  },
  'Revisor': {
    category: 'Revisor',
    tone: 'Professional, precise, trustworthy, and reliable',
    characteristics: [
      'Detail-oriented',
      'Credible and authoritative',
      'Clear and transparent',
      'Service-oriented'
    ],
    voiceGuidelines: 'Emphasize accuracy, reliability, and trust. Be professional yet accessible.'
  },
  'Konsulent': {
    category: 'Konsulent',
    tone: 'Professional, insightful, strategic, and helpful',
    characteristics: [
      'Expert guidance',
      'Solution-oriented',
      'Strategic thinking',
      'Results-focused'
    ],
    voiceGuidelines: 'Project expertise and insight. Focus on solutions and value delivery.'
  },

  // Home & Services
  'Ejendomsmægler': {
    category: 'Ejendomsmægler',
    tone: 'Professional, trustworthy, knowledgeable, and helpful',
    characteristics: [
      'Market expert',
      'Clear communicator',
      'Client advocate',
      'Results-oriented'
    ],
    voiceGuidelines: 'Balance professionalism with personal service. Build trust through expertise.'
  },
  'Håndværker': {
    category: 'Håndværker',
    tone: 'Reliable, skilled, straightforward, and honest',
    characteristics: [
      'Practical and solution-focused',
      'Quality craftsmanship',
      'Dependable service',
      'Clear communication'
    ],
    voiceGuidelines: 'Be straightforward and reliable. Emphasize quality work and dependability.'
  },
  'Rengøring': {
    category: 'Rengøring',
    tone: 'Reliable, thorough, trustworthy, and professional',
    characteristics: [
      'Detail-oriented',
      'Dependable service',
      'Quality-focused',
      'Respectful and discreet'
    ],
    voiceGuidelines: 'Emphasize reliability, thoroughness, and trust. Be professional and respectful.'
  },

  // Creative & Events
  'Fotograf': {
    category: 'Fotograf',
    tone: 'Creative, artistic, personal, and professional',
    characteristics: [
      'Visual storytelling',
      'Artistic vision',
      'Moment capturing',
      'Personal connection'
    ],
    voiceGuidelines: 'Show artistic passion while being professional. Emphasize storytelling and moments.'
  },
  'Eventbureau': {
    category: 'Eventbureau',
    tone: 'Creative, organized, exciting, and professional',
    characteristics: [
      'Detail-oriented planning',
      'Creative solutions',
      'Experience-focused',
      'Reliable execution'
    ],
    voiceGuidelines: 'Balance creativity with reliability. Create excitement while projecting professionalism.'
  },

  // Pet Services
  'Dyrlæge': {
    category: 'Dyrlæge',
    tone: 'Caring, professional, compassionate, and trustworthy',
    characteristics: [
      'Compassionate care',
      'Medical expertise',
      'Pet and owner focused',
      'Reassuring presence'
    ],
    voiceGuidelines: 'Show compassion for pets and owners. Balance medical expertise with emotional support.'
  },
  'Dyrepension': {
    category: 'Dyrepension',
    tone: 'Caring, playful, reliable, and loving',
    characteristics: [
      'Pet-loving',
      'Safety-focused',
      'Fun and engaging',
      'Peace of mind for owners'
    ],
    voiceGuidelines: 'Show genuine love for animals. Emphasize safety, care, and fun.'
  },

  // Education & Childcare
  'Børnehave': {
    category: 'Børnehave',
    tone: 'Warm, nurturing, playful, and professional',
    characteristics: [
      'Child development focused',
      'Safe and caring',
      'Educational and fun',
      'Parent partnership'
    ],
    voiceGuidelines: 'Be warm and reassuring to parents. Emphasize development, safety, and care.'
  },
  'Skole': {
    category: 'Skole',
    tone: 'Professional, supportive, educational, and caring',
    characteristics: [
      'Learning-focused',
      'Student development',
      'Community-oriented',
      'Clear communication'
    ],
    voiceGuidelines: 'Balance professionalism with warmth. Focus on learning and student success.'
  },

  // Automotive
  'Autoværksted': {
    category: 'Autoværksted',
    tone: 'Reliable, knowledgeable, honest, and straightforward',
    characteristics: [
      'Technical expertise',
      'Transparent pricing',
      'Dependable service',
      'Customer education'
    ],
    voiceGuidelines: 'Be straightforward and honest. Emphasize reliability and expertise.'
  },
  'Bilforhandler': {
    category: 'Bilforhandler',
    tone: 'Professional, helpful, knowledgeable, and trustworthy',
    characteristics: [
      'Product expertise',
      'Customer needs focused',
      'Transparent and fair',
      'Service-oriented'
    ],
    voiceGuidelines: 'Be helpful without being pushy. Focus on matching customer needs with solutions.'
  }
}

/**
 * Get tone card for a specific business category
 */
export function getToneCard(category: string): ToneCard | null {
  return TONE_CARDS[category] || null
}

/**
 * Get tone description for use in AI prompts
 */
export function getToneDescription(category: string): string {
  const toneCard = getToneCard(category)
  if (!toneCard) {
    return 'Tone: Professional, friendly, and neutral'
  }
  
  return `Tone: ${toneCard.tone}`
}

/**
 * Get all available categories
 */
export function getAllCategories(): string[] {
  return Object.keys(TONE_CARDS).sort()
}

/**
 * Get formatted category list for dropdowns
 */
export function getCategoryOptions(): Array<{ value: string; label: string }> {
  return getAllCategories().map(category => ({
    value: category,
    label: category
  }))
}
