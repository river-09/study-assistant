// Reads the raw text of each page out of a PDF. Only this file talks to the PDF
// library; cleaning and chunking the text happen in chunking.ts.
import { extractText, getDocumentProxy } from "unpdf";
import { PermanentIngestError } from "./ingest-errors";

// Protects the Gemini quota: every page becomes chunks to embed.
export const MAX_PAGES = 100;

export type RawPage = { pageNumber: number; text: string };

export async function extractPages(bytes: Uint8Array, maxPages = MAX_PAGES): Promise<RawPage[]> {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    // pdf.js may take ownership of the buffer it's given, so pass a copy.
    // verbosity 0 silences pdf.js's own console warnings.
    pdf = await getDocumentProxy(new Uint8Array(bytes), { verbosity: 0 });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "PasswordException") {
      throw new PermanentIngestError(
        "This PDF is password-protected. Remove the password and upload it again.",
      );
    }
    if (name === "InvalidPDFException") {
      throw new PermanentIngestError("This file is damaged or isn't a valid PDF.");
    }
    throw err; // something unexpected: let the job retry
  }

  try {
    if (pdf.numPages > maxPages) {
      throw new PermanentIngestError(
        `This PDF has ${pdf.numPages} pages. The limit is ${maxPages}.`,
      );
    }
    const { text } = await extractText(pdf, { mergePages: false });
    return text.map((pageText, i) => ({ pageNumber: i + 1, text: pageText }));
  } finally {
    // Free pdf.js's memory, even if we threw above. (In this pdf.js version
    // destroy() lives on the loading task, not on the document itself.)
    await pdf.loadingTask.destroy();
  }
}
