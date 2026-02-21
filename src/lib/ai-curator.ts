import Anthropic from '@anthropic-ai/sdk';
import { AIResponse } from './types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY?.trim(),
});

const CURATION_PROMPT = `You are a basketball content curator for an NBA fan community called Basketball Lobster.

Given the following content, do two things:
1. Write a 2-3 sentence summary that captures the key takeaway for NBA fans.
   Be concise, informative, and engaging. Do not use clickbait language.
2. Rate the content quality on a scale of 1-10 based on:
   - NBA relevance (must be primarily about NBA, non-NBA content scores 1-2)
   - Quality of analysis or reporting
   - Timeliness and newsworthiness
   - Engagement potential for serious basketball fans
   Score higher for: breaking news/trades, player stories/narratives, hot takes/debate content

Return ONLY a valid JSON object with no other text:
{"summary": "your 2-3 sentence summary", "score": 7, "reason": "brief explanation"}`;

export async function curateContent(
  headline: string,
  sourceName: string,
  contentText: string
): Promise<AIResponse> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `${CURATION_PROMPT}\n\nHeadline: ${headline}\nSource: ${sourceName}\nContent: ${contentText.slice(0, 2000)}`,
        },
      ],
    });

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';
    
    // Parse JSON response, handling potential markdown wrapping
    const cleaned = responseText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    
    const parsed = JSON.parse(cleaned) as AIResponse;
    
    // Validate score range
    parsed.score = Math.max(1, Math.min(10, Math.round(parsed.score)));
    
    return parsed;
  } catch (error) {
    console.error('AI curation error:', error);
    // Fallback: publish with needs_review flag
    return {
      summary: headline, // Use headline as fallback summary
      score: 5,
      reason: 'AI scoring failed — flagged for manual review',
    };
  }
}
