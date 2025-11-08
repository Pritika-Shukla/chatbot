import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'grok';
const COLLECTION_NAME = 'prompts';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const promptDoc = await collection.findOne({ id: 'system' });

    return NextResponse.json({
      prompt: promptDoc?.prompt || 'You are a helpful assistant.',
    });
  } catch (error) {
    console.error('Error fetching prompt:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prompt' },
      { status: 500 }
    );
  }
}

// POST/PUT - Update the system prompt
export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt must be a string' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Upsert the prompt (update if exists, insert if not)
    await collection.updateOne(
      { id: 'system' },
      {
        $set: {
          id: 'system',
          prompt: prompt,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true, prompt });
  } catch (error) {
    console.error('Error saving prompt:', error);
    return NextResponse.json(
      { error: 'Failed to save prompt' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  return POST(req);
}

