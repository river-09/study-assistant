// Types shared by the chat API route and the chat UI. No server imports here,
// so browser code can use this file.
import type { UIMessage } from "ai";

// One numbered source shown to the model as [n] and to the user as a chip.
export type Source = {
  n: number;
  chunkId: string;
  documentId: string;
  filename: string;
  pageNumber: number;
  content: string;
};

// Sent with each assistant message: which conversation it belongs to (so a
// new chat learns its id) and the sources its [n] markers refer to.
export type ChatMetadata = {
  conversationId?: string;
  sources?: Source[];
};

export type ChatUIMessage = UIMessage<ChatMetadata>;
