import { buildOpenAIImageRequest } from '../../src/shared/promptBuilder.ts';

export interface OpenAIImageResult {
  imageBase64: string;
  mimeType: string;
  revisedPrompt: string;
}

/**
 * Call OpenAI Images generations endpoint.
 * `fetchImpl` is injectable for tests (mock network boundary only).
 */
export async function generateImageWithOpenAI(options: {
  apiKey: string;
  prompt: string;
  model?: string;
  fetchImpl?: typeof fetch;
}): Promise<OpenAIImageResult> {
  const model = options.model ?? process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1';
  const fetchFn = options.fetchImpl ?? fetch;
  const body = buildOpenAIImageRequest(options.prompt, model);

  const response = await fetchFn('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(rawText) as unknown;
  } catch {
    throw new Error(`OpenAI returned non-JSON (${response.status}): ${rawText.slice(0, 200)}`);
  }

  if (!response.ok) {
    const errObj = json as { error?: { message?: string } };
    const message = errObj?.error?.message ?? rawText.slice(0, 300);
    throw new Error(`OpenAI image error (${response.status}): ${message}`);
  }

  return parseOpenAIImageResponse(json, options.prompt);
}

/** Pure parser for OpenAI images.generations JSON. */
export function parseOpenAIImageResponse(json: unknown, fallbackPrompt: string): OpenAIImageResult {
  const data = json as {
    data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
  };

  const first = data?.data?.[0];
  if (!first) {
    throw new Error('OpenAI response missing data[0].');
  }

  if (first.b64_json) {
    return {
      imageBase64: first.b64_json,
      mimeType: 'image/png',
      revisedPrompt: first.revised_prompt ?? fallbackPrompt,
    };
  }

  // Some models return URL only — caller may still accept URL as data URI fetch later.
  // For our API contract we require base64; surface a clear error if only URL is present.
  if (first.url) {
    throw new Error(
      'OpenAI returned a URL instead of b64_json. Configure the model to return base64 or upgrade the handler.',
    );
  }

  throw new Error('OpenAI response missing b64_json image payload.');
}
