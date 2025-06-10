import {onCall} from "firebase-functions/v1/https";
import OpenAI from "openai";

export const generateCode = onCall(async (request) => {
  const {prompt} = request.data;

  if (!prompt) throw new Error("Prompt is required.");

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a senior developer assistant for a Firebase + React " +
           "Tailwind app built for a printing & packaging company. Always " +
           "return clean, production-ready code.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.3,
  });

  return {
    result: completion.choices[0]?.message?.content || "No response.",
  };
});
