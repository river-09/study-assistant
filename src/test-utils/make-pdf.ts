// Test helper: builds a real PDF in memory, so tests don't need binary fixture
// files. Each entry in `pages` is one page; each string in a page is one line.
// An empty array makes a blank page (like a scanned page with no text layer).
import { PDFDocument, StandardFonts } from "pdf-lib";

export async function makePdf(pages: string[][]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) {
    const page = doc.addPage([612, 792]); // US Letter, in points
    let y = 740;
    for (const line of lines) {
      if (line !== "") page.drawText(line, { x: 50, y, size: 12, font });
      y -= 18; // an empty string leaves a blank line (a paragraph gap)
    }
  }
  return doc.save();
}
