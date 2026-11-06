// Turns the raw text of each PDF page into clean, overlapping chunks.
// Pure functions only (no database, files or network), so they're easy to test.
// The rules each function follows are pinned down in chunking.test.ts.

export type Page = { pageNumber: number; text: string };

export type Chunk = {
  pageNumber: number; // the page the chunk came from (1-based)
  chunkIndex: number; // 0, 1, 2, ... across the whole document
  content: string;
};

export type ChunkOptions = {
  chunkChars: number; // maximum length of one chunk, in characters
  overlapChars: number; // roughly how much of a chunk repeats at the start of the next
};

// ~500 tokens and ~75 tokens, using 1 token ≈ 4 characters.
export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = { chunkChars: 2000, overlapChars: 300 };

// Fewer non-whitespace characters per page than this, on average, and we treat
// the PDF as scanned (images of text, nothing to extract).
export const MIN_CHARS_PER_PAGE = 50;


export function cleanPageText(raw: string): string {
  const text = raw
    .normalize("NFKC") // bonus: "ﬁ" -> "fi", non-breaking space -> normal space
    .replace(/\r\n?/g, "\n") // Windows (\r\n) and old Mac (\r) line endings -> \n
    .replace(/-\n(?=[a-z])/g, ""); // "power-\nhouse" -> "powerhouse", before \n is touched

  return text
    .split(/\n[ \t]*\n/) // paragraphs are separated by a blank line
    .map((paragraph) =>
      paragraph
        .replace(/\n/g, " ") // a single line break inside a paragraph is just a wrap
        .replace(/[ \t]+/g, " ") // runs of spaces and tabs -> one space
        .trim(),
    )
    .filter((paragraph) => paragraph !== "") // drop paragraphs that were only whitespace
    .join("\n\n");
}


export function looksScanned(pages: Page[]): boolean {
  let total=0;
  
  for (const page of pages){
    const raw=page.text.replace(/\s+/g, "");
    
    total+=raw.length;
  }
  if(pages.length===0)return true;
  const avg=total/(pages.length);
  
  return (avg<MIN_CHARS_PER_PAGE);
}


// A break this early in the window would make a tiny chunk, so findBreak only
// uses paragraph and sentence breaks from halfway through the window onwards.
const MIN_BREAK_FRACTION = 0.5;

// Where should the chunk that starts at `start` end? Returns a position in
// `text` (exclusive, like slice). Prefers the latest paragraph break, then the
// latest sentence end, then the latest space; cuts mid-word only as a last resort.
function findBreak(text: string, start: number, chunkChars: number): number {
  const window = text.slice(start, start + chunkChars);
  const minLength = Math.floor(chunkChars * MIN_BREAK_FRACTION);

  // Positions below are inside `window`; adding `start` turns them into
  // positions inside `text`.
  const paragraph = window.lastIndexOf("\n\n");
  if (paragraph >= minLength) return start + paragraph;

  const sentence = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("? "),
    window.lastIndexOf("! "),
  );
  if (sentence >= minLength) return start + sentence + 1; // + 1 keeps the "." in this chunk

  const space = window.lastIndexOf(" ");
  if (space > 0) return start + space; // any space beats cutting a word in half

  return start + chunkChars; // no space at all: hard cut
}

// Where should the next chunk start? About `overlapChars` before `end`, moved
// forward to the start of a word. Always returns a position after `start`
// (so the loop always makes progress) and never after `end` (so no text is skipped).
function findOverlapStart(text: string, start: number, end: number, overlapChars: number): number {
  let next = Math.max(end - overlapChars, start + 1);
  while (next < end && !/\s/.test(text[next - 1])) next++;
  return next;
}

export function chunkPages(pages: Page[], options: ChunkOptions = DEFAULT_CHUNK_OPTIONS): Chunk[] {
  const { chunkChars, overlapChars } = options;
  if (chunkChars < 1 || overlapChars < 0 || overlapChars >= chunkChars) {
    throw new Error(
      `Invalid chunk options: need 0 <= overlapChars (${overlapChars}) < chunkChars (${chunkChars})`,
    );
  }

  const chunks: Chunk[] = [];
  let chunkIndex = 0; // outside the page loop: numbering continues across pages

  for (const page of pages) {
    const text = page.text;
    if (text.trim() === "") continue; // skip empty and whitespace-only pages

    let start = 0;
    while (start < text.length) {
      const restFits = text.length - start <= chunkChars;
      const end = restFits ? text.length : findBreak(text, start, chunkChars);

      const content = text.slice(start, end).trim();
      if (content !== "") {
        chunks.push({ pageNumber: page.pageNumber, chunkIndex, content });
        chunkIndex++;
      }

      if (restFits) break; // that was the last chunk of this page
      start = findOverlapStart(text, start, end, overlapChars);
    }
  }

  return chunks;
}
