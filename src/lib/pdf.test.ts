// extractPages is tested against real PDFs built in memory by makePdf.
import { describe, expect, it } from "vitest";
import { makePdf } from "@/test-utils/make-pdf";
import { PermanentIngestError } from "./ingest-errors";
import { extractPages } from "./pdf";

describe("extractPages", () => {
  it("returns one entry per page, numbered from 1", async () => {
    const pdf = await makePdf([["First page"], ["Second page"], ["Third page"]]);

    const pages = await extractPages(pdf);

    expect(pages.map((p) => p.pageNumber)).toEqual([1, 2, 3]);
    expect(pages[1].text).toContain("Second page");
  });

  it("returns an empty string for a blank page", async () => {
    const pdf = await makePdf([["Some text"], [], ["More text"]]);

    const pages = await extractPages(pdf);

    expect(pages[1].text).toBe("");
  });

  it("keeps each visual line on its own line", async () => {
    const pdf = await makePdf([["Line one", "Line two"]]);

    const [page] = await extractPages(pdf);

    expect(page.text).toBe("Line one\nLine two");
  });

  it("rejects a damaged PDF with a permanent error", async () => {
    const notReallyAPdf = new TextEncoder().encode("%PDF-1.4 this is not a real pdf");

    // For async code that should throw, await expect(...).rejects
    await expect(extractPages(notReallyAPdf)).rejects.toThrow(PermanentIngestError);
    await expect(extractPages(notReallyAPdf)).rejects.toThrow("damaged");
  });

  it("rejects a PDF over the page limit", async () => {
    const pdf = await makePdf([["a"], ["b"], ["c"]]);

    await expect(extractPages(pdf, 2)).rejects.toThrow("This PDF has 3 pages. The limit is 2.");
  });
});
