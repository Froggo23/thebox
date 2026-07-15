import type { Request, Response } from 'express';
import {
  buildImagePrompt,
  validateUserPrompt,
} from '../../src/shared/promptBuilder.ts';
import type { GenerateMode, GenerateRequestBody } from '../../src/shared/types.ts';
import { generateSceneImage, resolveImageProvider } from '../lib/generateImage.ts';
import { logGameTurn } from '../lib/gameLog.ts';
import { getSupabaseAdmin } from '../lib/supabase.ts';

export type GenerateDeps = {
  generateImage?: typeof generateSceneImage;
  getProvider?: typeof resolveImageProvider;
  getSupabase?: typeof getSupabaseAdmin;
  logTurn?: typeof logGameTurn;
};

const defaultDeps: GenerateDeps = {
  generateImage: generateSceneImage,
  getProvider: resolveImageProvider,
  getSupabase: getSupabaseAdmin,
  logTurn: logGameTurn,
};

/**
 * POST /api/generate
 * Body: { mode?, prompt?, history?, sessionId?, clientId? }
 */
export function createGenerateHandler(deps: GenerateDeps = defaultDeps) {
  return async function generateHandler(req: Request, res: Response): Promise<void> {
    try {
      const body = (req.body ?? {}) as GenerateRequestBody;
      const mode: GenerateMode = body.mode === 'addition' ? 'addition' : 'default';
      const history = Array.isArray(body.history)
        ? body.history.filter((h): h is string => typeof h === 'string')
        : [];

      let userPrompt: string | undefined;

      if (mode === 'addition') {
        const validated = validateUserPrompt(body.prompt);
        if (!validated.ok) {
          res.status(400).json({ error: validated.error });
          return;
        }
        userPrompt = validated.prompt;
      }

      // New plain-box generation starts a fresh session unless client reuses id intentionally
      const sessionIdIn =
        mode === 'default' && body.forceNewSession !== false
          ? null
          : body.sessionId?.trim() || null;

      const provider = (deps.getProvider ?? resolveImageProvider)();
      if (provider === 'openai' && !process.env.OPENAI_API_KEY?.trim()) {
        if (!deps.generateImage || deps.generateImage === generateSceneImage) {
          res.status(500).json({
            error: 'Server missing OPENAI_API_KEY (IMAGE_PROVIDER=openai).',
          });
          return;
        }
      }

      let revisedScenePrompt: string;
      try {
        revisedScenePrompt = buildImagePrompt({
          mode,
          userPrompt,
          history,
        });
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Invalid prompt composition.',
        });
        return;
      }

      const generateImage = deps.generateImage ?? generateSceneImage;
      const image = await generateImage({
        prompt: revisedScenePrompt,
      });

      let sessionId: string | null = sessionIdIn;
      let turnId: string | null = null;
      let imagePublicUrl: string | null = null;
      let logWarning: string | null = null;

      const supabase = (deps.getSupabase ?? getSupabaseAdmin)();
      const logTurn = deps.logTurn ?? logGameTurn;

      if (supabase) {
        try {
          const logged = await logTurn(supabase, {
            sessionId: sessionIdIn,
            clientId: body.clientId ?? null,
            mode,
            prompt: userPrompt,
            history,
            imageBase64: image.imageBase64,
            mimeType: image.mimeType,
            revisedPrompt: image.revisedPrompt,
          });
          sessionId = logged.sessionId;
          turnId = logged.turnId;
          imagePublicUrl = logged.imagePublicUrl;
        } catch (logErr) {
          logWarning = logErr instanceof Error ? logErr.message : 'Failed to log game turn';
          console.warn('[thebox] game log failed:', logWarning);
        }
      }

      res.status(200).json({
        imageBase64: image.imageBase64,
        mimeType: image.mimeType,
        revisedPrompt: image.revisedPrompt,
        mode,
        sessionId,
        turnId,
        imagePublicUrl,
        logWarning,
        provider,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown generation error.';
      res.status(502).json({ error: message });
    }
  };
}

export const generateHandler = createGenerateHandler();
