import { convertToModelMessages, streamText, UIMessage } from 'ai';
import { xai } from '@ai-sdk/xai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  // Parse request body
  const body = await req.json();

  // Extract messages, system, and model from body
  const { messages, system, model }: { messages: UIMessage[]; system?: string; model?: string } = body;

  // Validate messages exists and is an array
  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: 'Messages must be an array' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate model is one of the allowed models
  const allowedModels = ['grok-4-fast-reasoning', 'grok-4-fast-non-reasoning', 'grok-3-mini', 'grok-3'];
  const selectedModel = model && allowedModels.includes(model) ? model : 'grok-4-fast-reasoning';

  const result = streamText({
    model: xai(selectedModel),
    system: system || 'You are a helpful assistant.',
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}