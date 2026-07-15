import { describe, expect, it, vi } from 'vitest';
import {
  buildPollinationsImageUrl,
  generateImageWithPollinations,
} from '../server/lib/pollinationsImages';
import request from 'supertest';
import express from 'express';
import { createGenerateHandler } from '../server/routes/generate';
import { buildImagePrompt } from '../src/shared/promptBuilder';

describe('buildPollinationsImageUrl', () => {
  it('builds free CDN URL by default', () => {
    const url = buildPollinationsImageUrl({
      prompt: 'a cardboard box with a red hat',
      mode: 'free',
      width: 1024,
      height: 1024,
    });
    expect(url).toContain('https://image.pollinations.ai/prompt/');
    expect(url).toContain(encodeURIComponent('a cardboard box with a red hat'));
    expect(url).toContain('width=1024');
    expect(url).toContain('nologo=true');
  });

  it('builds gen API URL with key when mode=gen', () => {
    const url = buildPollinationsImageUrl({
      prompt: 'a cardboard box with a red hat',
      mode: 'gen',
      apiKey: 'sk_test',
      model: 'flux',
      width: 1024,
      height: 1024,
    });
    expect(url).toContain('https://gen.pollinations.ai/image/');
    expect(url).toContain('key=sk_test');
    expect(url).toContain('model=flux');
  });
});

describe('generateImageWithPollinations', () => {
  it('reads binary image bytes and returns base64', async () => {
    const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, ...Array(120).fill(1)]);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? 'image/png' : null) },
      arrayBuffer: async () => fakePng.buffer.slice(fakePng.byteOffset, fakePng.byteOffset + fakePng.byteLength),
    });

    const result = await generateImageWithPollinations({
      mode: 'free',
      prompt: 'a box',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.mimeType).toBe('image/png');
    expect(result.imageBase64.length).toBeGreaterThan(10);
    expect(result.revisedPrompt).toBe('a box');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [calledUrl] = fetchImpl.mock.calls[0];
    expect(String(calledUrl)).toContain('image.pollinations.ai/prompt/');
  });

  it('falls back to free CDN when gen returns 402', async () => {
    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, ...Array(120).fill(2)]);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 402,
        statusText: 'Payment Required',
        text: async () => 'Insufficient balance',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'image/jpeg' },
        arrayBuffer: async () =>
          fakeJpeg.buffer.slice(fakeJpeg.byteOffset, fakeJpeg.byteOffset + fakeJpeg.byteLength),
      });

    const result = await generateImageWithPollinations({
      mode: 'gen',
      apiKey: 'sk_empty',
      prompt: 'a box',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.mimeType).toBe('image/jpeg');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[1][0])).toContain('image.pollinations.ai/prompt/');
  });
});

describe('POST /api/generate with Pollinations mock', () => {
  it('returns image and logs session via injected generateImage', async () => {
    const app = express();
    app.use(express.json());
    app.post(
      '/api/generate',
      createGenerateHandler({
        getProvider: () => 'pollinations',
        generateImage: vi.fn().mockResolvedValue({
          imageBase64: 'POLLI_B64',
          mimeType: 'image/jpeg',
          revisedPrompt: buildImagePrompt({ mode: 'default' }),
        }),
        getSupabase: () => ({}) as never,
        logTurn: vi.fn().mockResolvedValue({
          sessionId: 'sess-p',
          turnId: 'turn-p',
          turnIndex: 0,
          imagePublicUrl: 'http://img/p.jpg',
          imagePath: 'sess-p/0.jpg',
        }),
      }),
    );

    const res = await request(app).post('/api/generate').send({ mode: 'default' });
    expect(res.status).toBe(200);
    expect(res.body.imageBase64).toBe('POLLI_B64');
    expect(res.body.provider).toBe('pollinations');
    expect(res.body.sessionId).toBe('sess-p');
  });

  it('rejects empty addition prompts', async () => {
    const app = express();
    app.use(express.json());
    app.post(
      '/api/generate',
      createGenerateHandler({
        getProvider: () => 'pollinations',
        generateImage: vi.fn(),
      }),
    );
    const res = await request(app).post('/api/generate').send({ mode: 'addition', prompt: '  ' });
    expect(res.status).toBe(400);
  });
});
