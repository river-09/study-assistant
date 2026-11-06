import { describe, expect, it } from "vitest";
import {
  chunkPages,
  cleanPageText,
  DEFAULT_CHUNK_OPTIONS,
  looksScanned,
  MIN_CHARS_PER_PAGE,
  type Page,
} from "./chunking";

describe("cleanPageText", () => {
  // One example to start you off:
  it("collapses runs of spaces into one", () => {
    expect(cleanPageText("too    many   spaces")).toBe("too many spaces");
  });

  it("joins a word hyphenated across a line break", () => {
    expect(cleanPageText("the power-\nhouse of the cell")).toBe("the powerhouse of the cell");
  });
  it("does not join a hyphen followed by a number or capital letter", () => {
    expect(cleanPageText("from 1990-\n1995")).toBe("from 1990- 1995");
    expect(cleanPageText("Covid-\nNineteen")).toBe("Covid- Nineteen");
  });
  it("turns a single line break into a space", ()=>{
    expect(cleanPageText("hi this is\na break")).toBe("hi this is a break");
  });
  it("does not leave extra spaces around a line break", () => {
    expect(cleanPageText("word \n word")).toBe("word word");
  });
  it("turns a blank line (two or more line breaks) into exactly one paragraph break", ()=>{
    expect(cleanPageText("hi this is a\n\nparabreak")).toBe("hi this is a\n\nparabreak");
    expect(cleanPageText("one\n  \n\n\ntwo")).toBe("one\n\ntwo");
  });
  it("handles Windows line endings", () => {
    expect(cleanPageText("one\r\ntwo\r\n\r\nthree")).toBe("one two\n\nthree");
  });
  it("turns ligatures into plain letters", () => {
    expect(cleanPageText("ﬁnal ﬂow")).toBe("final flow");
  });
  it("trims the start and end", ()=>{
    expect(cleanPageText("    here and here    ")).toBe("here and here");
  });
  it("returns an empty string for whitespace-only input", () => {
    expect(cleanPageText("  \n\t\n   ")).toBe("");
  });
});

// Test helper: pages("text of page 1", "text of page 2", ...) -> Page[]
function pages(...texts: string[]): Page[] {
  return texts.map((text, i) => ({ pageNumber: i + 1, text }));
}

describe("looksScanned", () => {
  it("is false for pages with plenty of text", () => {
    expect(looksScanned(pages("x".repeat(500), "y".repeat(300)))).toBe(false);
  });
  it("is true when every page is empty", () => {
    expect(looksScanned(pages("", "", ""))).toBe(true);
  });
  it("is true when the average is under MIN_CHARS_PER_PAGE", () => {
    // 60 + 0 + 0 = 60 characters over 3 pages = 20 per page
    expect(looksScanned(pages("x".repeat(60), "", ""))).toBe(true);
  });
  it("tolerates a few blank pages in a real document", () => {
    // a blank title slide doesn't make the whole document "scanned"
    expect(looksScanned(pages("", "x".repeat(400), "x".repeat(400)))).toBe(false);
  });
  it("ignores whitespace when counting characters", () => {
    expect(looksScanned(pages(" ".repeat(500), "\n\t ".repeat(100)))).toBe(true);
  });
  it("treats exactly MIN_CHARS_PER_PAGE as enough (the rule is 'fewer than')", () => {
    expect(looksScanned(pages("x".repeat(MIN_CHARS_PER_PAGE)))).toBe(false);
    expect(looksScanned(pages("x".repeat(MIN_CHARS_PER_PAGE - 1)))).toBe(true);
  });
  it("is true for a document with no pages", () => {
    expect(looksScanned([])).toBe(true);
  });
});

describe("chunkPages", () => {
  // Small sizes make failures easy to read.
  const small = { chunkChars: 100, overlapChars: 20 };
  // "Sentence 0. Sentence 1. ... Sentence 49." Every sentence is unique, so we
  // can find exactly where each chunk came from.
  const sentences = Array.from({ length: 50 }, (_, i) => `Sentence ${i}.`).join(" ");

  it("throws if overlapChars >= chunkChars", () => {
    expect(() => chunkPages(pages("hi"), { chunkChars: 10, overlapChars: 10 })).toThrow();
    expect(() => chunkPages(pages("hi"), { chunkChars: 10, overlapChars: 50 })).toThrow();
  });

  it("returns a short page as a single chunk", () => {
    expect(chunkPages(pages("A short page."), small)).toEqual([
      { pageNumber: 1, chunkIndex: 0, content: "A short page." },
    ]);
  });

  it("skips empty and whitespace-only pages", () => {
    const chunks = chunkPages(pages("first", "", "   \n\n  ", "fourth"), small);
    expect(chunks.map((c) => c.pageNumber)).toEqual([1, 4]);
  });

  it("numbers chunks 0, 1, 2... across pages, in order", () => {
    const chunks = chunkPages(pages(sentences, "", sentences), small);
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
    // page numbers never go backwards
    const pageNumbers = chunks.map((c) => c.pageNumber);
    expect(pageNumbers).toEqual([...pageNumbers].sort((a, b) => a - b));
    expect(new Set(pageNumbers)).toEqual(new Set([1, 3]));
  });

  it("never makes a chunk longer than chunkChars", () => {
    const chunks = chunkPages(pages(sentences), small);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.content.length <= small.chunkChars)).toBe(true);
  });

  it("stays within the default size on a realistic page", () => {
    const longPage = Array.from({ length: 400 }, (_, i) => `This is sentence number ${i} of the lecture.`).join(" ");
    const chunks = chunkPages(pages(longPage));
    expect(chunks.every((c) => c.content.length <= DEFAULT_CHUNK_OPTIONS.chunkChars)).toBe(true);
  });

  it("never mixes text from two pages in one chunk", () => {
    const chunks = chunkPages(pages("alpha ".repeat(60), "beta ".repeat(60)), small);
    for (const c of chunks) {
      if (c.pageNumber === 1) expect(c.content).not.toContain("beta");
      if (c.pageNumber === 2) expect(c.content).not.toContain("alpha");
    }
  });

  it("repeats at most overlapChars of text at the start of the next chunk", () => {
    const chunks = chunkPages(pages(sentences), small);
    for (let i = 1; i < chunks.length; i++) {
      const prevEnd = sentences.indexOf(chunks[i - 1].content) + chunks[i - 1].content.length;
      const nextStart = sentences.indexOf(chunks[i].content);
      const overlap = prevEnd - nextStart;
      expect(overlap).toBeGreaterThan(0); // they do overlap...
      expect(overlap).toBeLessThanOrEqual(small.overlapChars); // ...but not by more than asked
    }
  });

  it("prefers to end a chunk at a paragraph break, then a sentence end", () => {
    // Both a paragraph break and a later sentence end fit in the window: paragraph wins.
    const withParagraph = "aaa aaa aaa aaa aaa.\n\nbbb bbb. ccc ccc ccc ccc ccc ccc ccc";
    expect(chunkPages(pages(withParagraph), { chunkChars: 40, overlapChars: 5 })[0].content).toBe(
      "aaa aaa aaa aaa aaa.",
    );
    // No paragraph break: the sentence end wins over a later space.
    const noParagraph = "aaa aaa aaa aaa aaa. bbb bbb ccc ccc ccc";
    expect(chunkPages(pages(noParagraph), { chunkChars: 30, overlapChars: 5 })[0].content).toBe(
      "aaa aaa aaa aaa aaa.",
    );
  });

  it("does not start a chunk in the middle of a word", () => {
    const chunks = chunkPages(pages(sentences), small);
    for (const c of chunks) {
      const pos = sentences.indexOf(c.content);
      expect(pos === 0 || /\s/.test(sentences[pos - 1])).toBe(true);
    }
  });

  it("still splits text that has no spaces at all", () => {
    const chunks = chunkPages(pages("x".repeat(250)), small);
    expect(chunks.map((c) => c.content.length)).toEqual([100, 100, 50]);
  });

  it("keeps all of the page's text (nothing is lost between chunks)", () => {
    const chunks = chunkPages(pages(sentences), small);
    for (let i = 0; i < 50; i++) {
      expect(chunks.some((c) => c.content.includes(`Sentence ${i}.`))).toBe(true);
    }
  });
});
