// The Gemini chat model, through the AI SDK. Shared by chat and quizzes.
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

export function chatModel() {
  const model = process.env.GEMINI_CHAT_MODEL;
  if (!model) throw new Error("GEMINI_CHAT_MODEL is not set. Check .env.local.");
  return google(model);
}
