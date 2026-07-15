import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BOX_SCENE,
  buildImagePrompt,
  buildOpenAIImageRequest,
  validateUserPrompt,
} from '../src/shared/promptBuilder';

describe('validateUserPrompt', () => {
  it('rejects empty prompts', () => {
    expect(validateUserPrompt('')).toEqual({ ok: false, error: 'Prompt cannot be empty.' });
    expect(validateUserPrompt('   ')).toEqual({ ok: false, error: 'Prompt cannot be empty.' });
  });

  it('rejects non-strings', () => {
    expect(validateUserPrompt(null).ok).toBe(false);
    expect(validateUserPrompt(42).ok).toBe(false);
  });

  it('accepts trimmed prompts', () => {
    expect(validateUserPrompt('  add a hat  ')).toEqual({ ok: true, prompt: 'add a hat' });
  });

  it('rejects overly long prompts', () => {
    const long = 'x'.repeat(501);
    expect(validateUserPrompt(long).ok).toBe(false);
  });
});

describe('buildImagePrompt', () => {
  it('builds a default box scene without user text', () => {
    const prompt = buildImagePrompt({ mode: 'default' });
    expect(prompt).toContain(DEFAULT_BOX_SCENE.slice(0, 40));
    expect(prompt.toLowerCase()).toContain('box');
    expect(prompt.toLowerCase()).toContain('photorealistic');
  });

  it('includes user addition and history for addition mode', () => {
    const prompt = buildImagePrompt({
      mode: 'addition',
      userPrompt: 'add a red hat',
      history: ['put sunglasses on it'],
    });
    expect(prompt).toContain('put sunglasses on it');
    expect(prompt).toContain('add a red hat');
    expect(prompt).toContain(DEFAULT_BOX_SCENE.slice(0, 30));
  });

  it('throws when addition mode has nothing to add', () => {
    expect(() => buildImagePrompt({ mode: 'addition', userPrompt: '  ', history: [] })).toThrow(
      /non-empty/i,
    );
  });
});

describe('buildOpenAIImageRequest', () => {
  it('shapes the Images API payload for default and addition prompts', () => {
    const defaultPrompt = buildImagePrompt({ mode: 'default' });
    const additionPrompt = buildImagePrompt({
      mode: 'addition',
      userPrompt: 'add a hat',
    });

    const defaultReq = buildOpenAIImageRequest(defaultPrompt, 'gpt-image-1');
    const additionReq = buildOpenAIImageRequest(additionPrompt, 'gpt-image-1');

    expect(defaultReq.model).toBe('gpt-image-1');
    expect(defaultReq.prompt).toBe(defaultPrompt);
    expect(defaultReq.n).toBe(1);
    expect(defaultReq.size).toBe('1024x1024');
    // gpt-image models omit response_format; dall-e includes b64_json
    expect(defaultReq.response_format).toBeUndefined();
    expect(buildOpenAIImageRequest('x', 'dall-e-3').response_format).toBe('b64_json');
    expect(additionReq.prompt).toContain('add a hat');
    expect(additionReq.n).toBe(1);
    expect(additionReq.size).toBe('1024x1024');
  });
});
