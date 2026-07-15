/**
 * Pollinations image generation.
 *
 * - Free public: https://image.pollinations.ai/prompt/{prompt}  (no key, works offline-of-billing)
 * - Auth gen API: https://gen.pollinations.ai/image/{prompt}   (needs key + pollen balance)
 *
 * Default strategy: free public endpoint. If POLLINATIONS_MODE=gen and a key is set,
 * use the authenticated gen API (and optionally fall back to free on 402).
 */

export interface PollinationsImageResult {
  imageBase64: string;
  mimeType: string;
  revisedPrompt: string;
}

export type PollinationsMode = 'free' | 'gen';

export function resolvePollinationsMode(): PollinationsMode {
  const raw = (process.env.POLLINATIONS_MODE ?? 'free').trim().toLowerCase();
  if (raw === 'gen' || raw === 'paid' || raw === 'auth') return 'gen';
  return 'free';
}

/** Pure URL builder — no network. */
export function buildPollinationsImageUrl(options: {
  prompt: string;
  mode?: PollinationsMode;
  apiKey?: string;
  model?: string;
  width?: number;
  height?: number;
  seed?: number;
}): string {
  const mode = options.mode ?? resolvePollinationsMode();
  const width = String(options.width ?? 1024);
  const height = String(options.height ?? 1024);
  const encoded = encodeURIComponent(options.prompt);

  if (mode === 'free') {
    const params = new URLSearchParams({
      width,
      height,
      nologo: 'true',
      // model hint is best-effort on the free CDN
      model: options.model ?? process.env.POLLINATIONS_IMAGE_MODEL ?? 'flux',
    });
    if (options.seed !== undefined) params.set('seed', String(options.seed));
    return `https://image.pollinations.ai/prompt/${encoded}?${params.toString()}`;
  }

  const params = new URLSearchParams({
    model: options.model ?? process.env.POLLINATIONS_IMAGE_MODEL ?? 'flux',
    width,
    height,
    nologo: 'true',
    enhance: 'true',
  });
  if (options.seed !== undefined) params.set('seed', String(options.seed));
  if (options.apiKey) params.set('key', options.apiKey);
  return `https://gen.pollinations.ai/image/${encoded}?${params.toString()}`;
}

async function fetchImageBytes(
  url: string,
  fetchFn: typeof fetch,
  headers: Record<string, string>,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const response = await fetchFn(url, {
    method: 'GET',
    headers: {
      Accept: 'image/*',
      ...headers,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Pollinations image error (${response.status}): ${text.slice(0, 300) || response.statusText}`,
    );
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  if (contentType.includes('application/json') || contentType.includes('text/')) {
    const text = await response.text();
    throw new Error(`Pollinations returned non-image payload: ${text.slice(0, 300)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 100) {
    throw new Error('Pollinations returned an empty or tiny image payload.');
  }

  return {
    buffer,
    mimeType: contentType.split(';')[0]?.trim() || 'image/jpeg',
  };
}

export async function generateImageWithPollinations(options: {
  apiKey?: string;
  prompt: string;
  model?: string;
  mode?: PollinationsMode;
  fetchImpl?: typeof fetch;
  /** When using gen mode, fall back to free CDN on payment/auth failures (default true). */
  fallbackToFree?: boolean;
}): Promise<PollinationsImageResult> {
  const fetchFn = options.fetchImpl ?? fetch;
  const mode = options.mode ?? resolvePollinationsMode();
  const fallbackToFree = options.fallbackToFree !== false;

  const tryOnce = async (useMode: PollinationsMode) => {
    const url = buildPollinationsImageUrl({
      prompt: options.prompt,
      mode: useMode,
      apiKey: useMode === 'gen' ? options.apiKey : undefined,
      model: options.model,
    });
    const headers: Record<string, string> = {};
    if (useMode === 'gen' && options.apiKey) {
      headers.Authorization = `Bearer ${options.apiKey}`;
    }
    return fetchImageBytes(url, fetchFn, headers);
  };

  try {
    if (mode === 'gen' && !options.apiKey?.trim()) {
      throw new Error('Pollinations gen mode requires POLLINATIONS_API_KEY.');
    }
    const { buffer, mimeType } = await tryOnce(mode);
    return {
      imageBase64: buffer.toString('base64'),
      mimeType,
      revisedPrompt: options.prompt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const shouldFallback =
      mode === 'gen' &&
      fallbackToFree &&
      (/402|401|PAYMENT|balance|Unauthorized|Insufficient/i.test(message) ||
        message.includes('Pollinations gen mode requires'));

    if (!shouldFallback) throw err;

    console.warn('[thebox] Pollinations gen failed; falling back to free image CDN:', message.slice(0, 160));
    const { buffer, mimeType } = await tryOnce('free');
    return {
      imageBase64: buffer.toString('base64'),
      mimeType,
      revisedPrompt: options.prompt,
    };
  }
}
