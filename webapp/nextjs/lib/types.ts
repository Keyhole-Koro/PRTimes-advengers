export interface PressRelease {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ErrorResponse {
  code: string;
  message: string;
}

export interface TipTapContent {
  type: string;
  content?: TipTapNode[];
  attrs?: Record<string, any>;
}

export interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  attrs?: Record<string, any>;
}
