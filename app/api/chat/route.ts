import { convertToModelMessages, streamText, UIMessage } from 'ai';
import { xai } from '@ai-sdk/xai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // Parse request body
    const body = await req.json();

    // Extract messages, system, and model from body
    const { messages, system, model }: { messages: UIMessage[]; system?: string; model?: string } = body;

    // Validate messages exists and is an array
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid request: Messages must be an array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate messages array is not empty
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid request: Messages array cannot be empty' }), {
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
  } catch (error) {
    console.error('Chat API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred while processing your request. Please try again.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}