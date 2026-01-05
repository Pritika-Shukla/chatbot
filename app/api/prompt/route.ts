import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'test-db-maga-patriot';
const COLLECTION_NAME = 'SystemPrompt';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const promptDoc = await collection.findOne({});

    return NextResponse.json({
      prompt: promptDoc?.xaiSystemPrompt || 'You are a helpful assistant.',
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
    const existingDoc = await collection.findOne({});
    const now = new Date();
    
    if (existingDoc) {
      // Update existing document
      await collection.updateOne(
        { _id: existingDoc._id },
        {
          $set: {
            xaiSystemPrompt: prompt,
            updatedAt: now,
          },
        }
      );
    } else {
      // Insert new document
      await collection.insertOne({
        xaiSystemPrompt: prompt,
        createdAt: now,
        updatedAt: now,
      });
    }

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

