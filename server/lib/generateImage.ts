import { generateImageWithOpenAI, type OpenAIImageResult } from './openaiImages.ts';
import { generateImageWithPollinations } from './pollinationsImages.ts';

export type ImageResult = OpenAIImageResult;

export type ImageProvider = 'pollinations' | 'openai';

export function resolveImageProvider(): ImageProvider {
  const raw = (process.env.IMAGE_PROVIDER ?? 'pollinations').trim().toLowerCase();
  if (raw === 'openai') return 'openai';
  return 'pollinations';
}

/**
 * Unified image generation entry. Default provider: Pollinations.
 * OpenAI remains available via IMAGE_PROVIDER=openai.
 */
export async function generateSceneImage(options: {
  prompt: string;
  fetchImpl?: typeof fetch;
}): Promise<ImageResult> {
  const provider = resolveImageProvider();

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('Server missing OPENAI_API_KEY (IMAGE_PROVIDER=openai).');
    }
    return generateImageWithOpenAI({
      apiKey,
      prompt: options.prompt,
      fetchImpl: options.fetchImpl,
    });
  }

  // Free mode needs no key; gen mode uses POLLINATIONS_API_KEY and falls back to free on 402.
  const apiKey = process.env.POLLINATIONS_API_KEY?.trim();
  return generateImageWithPollinations({
    apiKey,
    prompt: options.prompt,
    fetchImpl: options.fetchImpl,
  });
}
