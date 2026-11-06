// Checks that the Gemini API key works and shows which models it can use.
// Run with: npm run check:gemini
// Costs: listing models is free; each model check below is one request.

import { GoogleGenAI } from "@google/genai";

const EMBED_DIMENSIONS = 768; // must match vector(768) in the database

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is empty. Paste your key into .env.local.");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });

  // 1. List models, grouped by what they can do.
  const chatModels: string[] = [];
  const embedModels: string[] = [];
  const pager = await ai.models.list();
  for await (const model of pager) {
    const name = model.name?.replace("models/", "") ?? "";
    const actions = model.supportedActions ?? [];
    if (actions.includes("generateContent")) chatModels.push(name);
    if (actions.includes("embedContent")) embedModels.push(name);
  }
  console.log("Chat models (look for a flash-lite one):");
  for (const name of chatModels) console.log("  " + name);
  console.log("\nEmbedding models:");
  for (const name of embedModels) console.log("  " + name);

  // 2. If model names are set in .env.local, make one real call to each.
  const chatModel = process.env.GEMINI_CHAT_MODEL;
  const embedModel = process.env.GEMINI_EMBED_MODEL;

  if (chatModel) {
    const res = await ai.models.generateContent({
      model: chatModel,
      contents: "Reply with exactly: OK",
    });
    console.log(`\nChat check (${chatModel}): ${res.text?.trim()}`);
  }

  if (embedModel) {
    const res = await ai.models.embedContent({
      model: embedModel,
      contents: "Mitochondria are the powerhouse of the cell.",
      config: { outputDimensionality: EMBED_DIMENSIONS },
    });
    const length = res.embeddings?.[0]?.values?.length;
    const ok = length === EMBED_DIMENSIONS;
    console.log(
      `Embed check (${embedModel}): ${length} dimensions ${ok ? "OK" : `FAIL, expected ${EMBED_DIMENSIONS}`}`,
    );
    if (!ok) process.exit(1);
  }

  if (!chatModel || !embedModel) {
    console.log(
      "\nNext: copy a model name from above into GEMINI_CHAT_MODEL and GEMINI_EMBED_MODEL in .env.local, then run this again.",
    );
  }
}

main().catch((err) => {
  console.error("Gemini check failed:", err?.message ?? err);
  process.exit(1);
});
