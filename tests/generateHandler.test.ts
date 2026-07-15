import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createGenerateHandler } from '../server/routes/generate';
import { parseOpenAIImageResponse } from '../server/lib/openaiImages';
import { buildImagePrompt, buildOpenAIImageRequest } from '../src/shared/promptBuilder';

function makeApp(handler: ReturnType<typeof createGenerateHandler>) {
  const app = express();
  app.use(express.json());
  app.post('/api/generate', handler);
  return app;
}

describe('parseOpenAIImageResponse', () => {
  it('extracts b64 image payload', () => {
    const result = parseOpenAIImageResponse(
      {
        data: [{ b64_json: 'abc123', revised_prompt: 'a box with a hat' }],
      },
      'fallback',
    );
    expect(result.imageBase64).toBe('abc123');
    expect(result.mimeType).toBe('image/png');
    expect(result.revisedPrompt).toBe('a box with a hat');
  });

  it('throws when payload is empty', () => {
    expect(() => parseOpenAIImageResponse({ data: [] }, 'x')).toThrow(/missing data/i);
  });
});

describe('buildOpenAIImageRequest (optional provider)', () => {
  it('shapes default and addition prompts', () => {
    const defaultPrompt = buildImagePrompt({ mode: 'default' });
    const additionPrompt = buildImagePrompt({ mode: 'addition', userPrompt: 'add a hat' });
    const req = buildOpenAIImageRequest(defaultPrompt, 'gpt-image-1');
    expect(req.prompt).toBe(defaultPrompt);
    expect(additionPrompt).toContain('add a hat');
  });
});

describe('POST /api/generate (mocked network)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects empty prompt in addition mode', async () => {
    const app = makeApp(
      createGenerateHandler({
        generateImage: vi.fn(),
      }),
    );

    const res = await request(app).post('/api/generate').send({ mode: 'addition', prompt: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/empty/i);
  });

  it('builds default-box request and returns image base64 + logs session', async () => {
    const generateImage = vi.fn().mockResolvedValue({
      imageBase64: 'BASE64_DEFAULT_BOX',
      mimeType: 'image/png',
      revisedPrompt: 'photorealistic box',
    });
    const logTurn = vi.fn().mockResolvedValue({
      sessionId: 'sess-log',
      turnId: 'turn-log',
      turnIndex: 0,
      imagePublicUrl: 'http://img/box.png',
      imagePath: 'sess-log/0.png',
    });

    const app = makeApp(
      createGenerateHandler({
        getProvider: () => 'pollinations',
        generateImage,
        getSupabase: () => ({}) as never,
        logTurn,
      }),
    );

    const res = await request(app).post('/api/generate').send({ mode: 'default' });

    expect(res.status).toBe(200);
    expect(res.body.imageBase64).toBe('BASE64_DEFAULT_BOX');
    expect(res.body.mode).toBe('default');
    expect(res.body.sessionId).toBe('sess-log');
    expect(generateImage).toHaveBeenCalledTimes(1);
    expect(logTurn).toHaveBeenCalledTimes(1);

    const arg = generateImage.mock.calls[0][0];
    expect(arg.prompt).toBe(buildImagePrompt({ mode: 'default' }));
    expect(arg.prompt.toLowerCase()).toContain('box');
  });

  it('builds addition prompt with history and returns image', async () => {
    const generateImage = vi.fn().mockResolvedValue({
      imageBase64: 'BASE64_HAT',
      mimeType: 'image/png',
      revisedPrompt: 'box with hat',
    });

    const app = makeApp(
      createGenerateHandler({
        getProvider: () => 'pollinations',
        generateImage,
      }),
    );

    const res = await request(app)
      .post('/api/generate')
      .send({ mode: 'addition', prompt: 'add a red hat', history: ['add sunglasses'] });

    expect(res.status).toBe(200);
    expect(res.body.imageBase64).toBe('BASE64_HAT');
    expect(res.body.mode).toBe('addition');

    const arg = generateImage.mock.calls[0][0];
    expect(arg.prompt).toContain('add sunglasses');
    expect(arg.prompt).toContain('add a red hat');
  });

  it('surfaces provider failures as 502', async () => {
    const app = makeApp(
      createGenerateHandler({
        getProvider: () => 'pollinations',
        generateImage: vi.fn().mockRejectedValue(new Error('Pollinations image error (401): bad')),
      }),
    );

    const res = await request(app).post('/api/generate').send({ mode: 'default' });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/Pollinations/i);
  });
});
