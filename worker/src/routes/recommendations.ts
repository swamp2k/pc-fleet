import type { Env } from '../index';
import { makeDb } from '../db';
import { json } from '../router';
import { authenticateDashboard } from '../auth';
import { buildPromptInput, generateRecommendation, MODEL } from '../llm';

export function makeRecommendationRoutes(env: Env) {
  const db = makeDb(env.DB);

  async function list(request: Request, params: Record<string, string>): Promise<Response> {
    const auth = await authenticateDashboard(request, env);
    if (!auth) return json({ error: 'unauthorized' }, 401);

    const recs = await db.listRecommendations(params.id);
    return json({ recommendations: recs });
  }

  async function generate(request: Request, params: Record<string, string>): Promise<Response> {
    const auth = await authenticateDashboard(request, env);
    if (!auth) return json({ error: 'unauthorized' }, 401);

    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'ANTHROPIC_API_KEY not configured' }, 503);
    }

    let promptInput;
    try {
      promptInput = await buildPromptInput(db, params.id);
    } catch (err) {
      if (err instanceof Error && err.message === 'device not found') {
        return json({ error: 'device not found' }, 404);
      }
      throw err;
    }

    let recommendationText: string;
    try {
      recommendationText = await generateRecommendation(env.ANTHROPIC_API_KEY, promptInput);
    } catch (err) {
      console.error('Anthropic API error:', err);
      return json({ error: 'failed to generate recommendation' }, 502);
    }

    const id = crypto.randomUUID();
    await db.saveRecommendation({
      id,
      device_id: params.id,
      prompt_input_json: JSON.stringify(promptInput),
      recommendation_text: recommendationText,
      model_used: MODEL,
    });

    return json({ id, recommendation_text: recommendationText, model_used: MODEL }, 201);
  }

  return { list, generate };
}
