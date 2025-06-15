
import { NextResponse } from 'next/server';
import { callGemini } from '@/lib/gemini/geminiClient';

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const response = await callGemini(prompt);

  return NextResponse.json({ result: response });
}
