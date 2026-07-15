/**
 * Pure prompt composition for The Box image game.
 * Shared by server and tests — no network side effects.
 */

export const DEFAULT_BOX_SCENE =
  'A photorealistic studio photograph of a single simple cardboard box centered in the frame. ' +
  'The box is closed, plain kraft cardboard, sitting on a clean seamless light-gray surface. ' +
  'Soft diffused lighting, shallow depth of field, high detail, no text overlays, no watermark, no people.';

const QUALITY_TAIL =
  'Photorealistic photo, natural materials, consistent lighting, centered composition, no cartoon, no SVG, no illustration style.';

/**
 * Build the full image-generation prompt.
 * - default mode: only the base box scene
 * - addition mode: base box + cumulative history + latest user text
 */
export function buildImagePrompt(options: {
  mode: 'default' | 'addition';
  userPrompt?: string;
  history?: string[];
}): string {
  const history = (options.history ?? []).map((h) => h.trim()).filter(Boolean);

  if (options.mode === 'default') {
    return `${DEFAULT_BOX_SCENE} ${QUALITY_TAIL}`;
  }

  const latest = (options.userPrompt ?? '').trim();
  const additions = [...history];
  if (latest) {
    additions.push(latest);
  }

  if (additions.length === 0) {
    throw new Error('Addition mode requires a non-empty prompt or history.');
  }

  const additionList = additions.map((a, i) => `${i + 1}. ${a}`).join(' ');

  return (
    `${DEFAULT_BOX_SCENE} ` +
    `The same box remains the main subject. Apply these scene additions while keeping the box recognizable: ${additionList} ` +
    `${QUALITY_TAIL}`
  );
}

/** Reject empty / whitespace-only user prompts for addition requests. */
export function validateUserPrompt(prompt: unknown): { ok: true; prompt: string } | { ok: false; error: string } {
  if (typeof prompt !== 'string') {
    return { ok: false, error: 'Prompt must be a string.' };
  }
  const trimmed = prompt.trim();
  if (!trimmed) {
    return { ok: false, error: 'Prompt cannot be empty.' };
  }
  if (trimmed.length > 500) {
    return { ok: false, error: 'Prompt must be 500 characters or fewer.' };
  }
  return { ok: true, prompt: trimmed };
}

/**
 * Shape the OpenAI Images API request body (no network).
 * Uses b64_json so the browser never needs a signed CDN URL.
 */
export function buildOpenAIImageRequest(prompt: string, model: string): {
  model: string;
  prompt: string;
  n: number;
  size: string;
  response_format?: 'b64_json' | 'url';
} {
  const body: {
    model: string;
    prompt: string;
    n: number;
    size: string;
    response_format?: 'b64_json' | 'url';
  } = {
    model,
    prompt,
    n: 1,
    size: '1024x1024',
  };

  // dall-e-* accepts response_format; gpt-image-* returns base64 by default and may reject the field.
  if (model.startsWith('dall-e')) {
    body.response_format = 'b64_json';
  }

  return body;
}
