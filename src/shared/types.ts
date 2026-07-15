export type GenerateMode = 'default' | 'addition';

export interface GenerateRequestBody {
  /** User addition, e.g. "add a red hat". Empty only allowed for mode=default. */
  prompt?: string;
  /** default = base box photo; addition = box + cumulative edits */
  mode?: GenerateMode;
  /** Prior user additions, oldest first */
  history?: string[];
  /** Existing Supabase game session id (for addition turns) */
  sessionId?: string | null;
  /** Anonymous browser client id for grouping */
  clientId?: string | null;
  /**
   * When true (default for mode=default), create a new game session.
   * Set false only if you intentionally continue a session.
   */
  forceNewSession?: boolean;
}

export interface GenerateSuccessResponse {
  imageBase64: string;
  mimeType: string;
  revisedPrompt: string;
  mode: GenerateMode;
  sessionId?: string | null;
  turnId?: string | null;
  imagePublicUrl?: string | null;
  logWarning?: string | null;
}

export interface GameSessionSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  turn_count: number;
  latest_image_url: string | null;
}

export interface GameTurnDetail {
  id: string;
  turn_index: number;
  mode: string;
  prompt: string | null;
  history: string[];
  image_public_url: string | null;
  revised_prompt: string | null;
  created_at: string;
}

export interface GameSessionDetail {
  session: {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
  };
  turns: GameTurnDetail[];
}

export interface GenerateErrorResponse {
  error: string;
}

export type GenerateResponse = GenerateSuccessResponse | GenerateErrorResponse;
