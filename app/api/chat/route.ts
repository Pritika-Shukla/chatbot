import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, streamText, UIMessage } from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Get the secret key from environment variables
const SECRET_KEY = process.env.CHATBOT_SECRET_KEY;

export async function POST(req: Request) {
  // Check if secret key is configured
  if (!SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Extract secret key from request headers
  const authHeader = req.headers.get('authorization');
  const headerKey = authHeader?.replace('Bearer ', '');

  // Parse request body
  const body = await req.json();
  const bodyKey = body.secretKey;

  // Get secret key from header or body
  const providedKey = headerKey || bodyKey;

  // Validate secret key
  if (!providedKey || providedKey !== SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid secret key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Extract messages and system from body (remove secretKey if it was in body)
  const { messages, system }: { messages: UIMessage[]; system?: string } = body;

  // Validate messages exists and is an array
  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: 'Messages must be an array' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = streamText({
    model: openai('gpt-4.1'),
    system: system || 'You are a helpful assistant.',
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}