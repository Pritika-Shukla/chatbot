import { convertToModelMessages, streamText, UIMessage } from 'ai';
import { xai } from '@ai-sdk/xai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  // Parse request body
  const body = await req.json();

  // Extract messages and system from body
  const { messages, system }: { messages: UIMessage[]; system?: string } = body;

  // Validate messages exists and is an array
  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: 'Messages must be an array' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = streamText({
    model:  xai('grok-4'),
    system: system || 'You are a helpful assistant.',
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}