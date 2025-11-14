// Backend API route (if using Vercel/Next.js API routes)
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(req: Request) {
  try {
    const { topic, businessType, platforms } = await req.json()
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // ✅ Make sure it's gpt-4o-mini!
      messages: [
        {
          role: "system",
          content: "You are a professional social media copywriter for Danish small businesses."
        },
        {
          role: "user",
          content: `Create 3 social media post variations about: ${topic}

Business type: ${businessType}
Platforms: ${platforms.join(', ')}

Requirements:
- Write in Danish
- Include relevant emojis
- Add 3-5 hashtags
- Include clear CTA
- Make one casual, one professional, one fun

Return ONLY valid JSON:
{
  "variations": [
    {
      "id": 1,
      "headline": "...",
      "text": "...",
      "hashtags": "...",
      "cta": "...",
      "tone": "casual"
    },
    // ... 2 more
  ]
}`
        }
      ],
      temperature: 0.8,
      max_tokens: 1500,
      response_format: { type: "json_object" }
    })
    
    const content = completion.choices[0].message.content
    if (!content) {
      throw new Error('No content received from OpenAI')
    }
    return Response.json(JSON.parse(content))
    
  } catch (error) {
    console.error('OpenAI error:', error)
    return Response.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    )
  }
}