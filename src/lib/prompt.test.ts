import { describe, expect, it } from "vitest";
import type { Source } from "./chat-types";
import { buildUserPrompt, citedNumbers, splitCitations } from "./prompt";

const source = (n: number, pageNumber: number, content: string): Source => ({
  n,
  chunkId: `chunk-${n}`,
  documentId: "doc-1",
  filename: "lecture-4.pdf",
  pageNumber,
  content,
});

describe("buildUserPrompt", () => {
  it("numbers each source with its file and page, then asks the question", () => {
    const prompt = buildUserPrompt("What makes ATP?", [
      source(1, 1, "Mitochondria make ATP."),
      source(2, 3, "Ribosomes make proteins."),
    ]);
    expect(prompt).toBe(
      "Sources:\n\n[1] (lecture-4.pdf, page 1)\nMitochondria make ATP.\n\n" +
        "[2] (lecture-4.pdf, page 3)\nRibosomes make proteins.\n\nQuestion: What makes ATP?",
    );
  });
});

describe("citedNumbers", () => {
  it("returns cited numbers in order of first use, without duplicates", () => {
    expect(citedNumbers("B [2]. A [1]. B again [2].", 3)).toEqual([2, 1]);
  });

  it("reads adjacent and comma-separated citations", () => {
    expect(citedNumbers("x [1][3] y [2, 4]", 4)).toEqual([1, 3, 2, 4]);
  });

  it("ignores numbers that aren't real sources", () => {
    expect(citedNumbers("made up [0] [7] real [2]", 3)).toEqual([2]);
  });

  it("returns nothing when there are no citations", () => {
    expect(citedNumbers("No citations here.", 3)).toEqual([]);
  });
});

describe("splitCitations", () => {
  it("splits text and markers for rendering chips", () => {
    expect(splitCitations("ATP is made in mitochondria [1][2].")).toEqual([
      "ATP is made in mitochondria ",
      1,
      2,
      ".",
    ]);
  });

  it("expands comma lists and keeps text with no markers whole", () => {
    expect(splitCitations("see [1, 3]")).toEqual(["see ", 1, 3]);
    expect(splitCitations("plain")).toEqual(["plain"]);
  });
});
