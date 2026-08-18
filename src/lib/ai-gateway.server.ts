// Server-only helper. Loaded inside server function/route handlers only.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export type AiProviderName = "openai" | "lovable";

export type AiRuntimeConfig = {
  name: AiProviderName;
  apiKey: string;
  baseURL: string;
  headers: Record<string, string>;
  chatModel: string;
  imageModel: string;
  transcriptionModel: string;
};

export function getAiRuntimeConfig(env: NodeJS.ProcessEnv = process.env): AiRuntimeConfig {
  const name = (env.AI_PROVIDER?.trim().toLowerCase() || "openai") as AiProviderName;
  if (name !== "openai" && name !== "lovable") {
    throw new Error("AI_PROVIDER must be either 'openai' or 'lovable'");
  }

  if (name === "openai") {
    const apiKey = env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY for AI_PROVIDER=openai");
    return {
      name,
      apiKey,
      baseURL: "https://api.openai.com/v1",
      headers: { Authorization: `Bearer ${apiKey}` },
      chatModel: env.OPENAI_CHAT_MODEL?.trim() || "gpt-5.4-mini",
      imageModel: env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1.5",
      transcriptionModel: env.OPENAI_TRANSCRIPTION_MODEL?.trim() || "gpt-4o-mini-transcribe",
    };
  }

  const apiKey = env.LOVABLE_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY for AI_PROVIDER=lovable");
  return {
    name,
    apiKey,
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
    chatModel: env.LOVABLE_CHAT_MODEL?.trim() || "google/gemini-2.5-flash",
    imageModel: env.LOVABLE_IMAGE_MODEL?.trim() || "google/gemini-3-pro-image-preview",
    transcriptionModel: env.LOVABLE_TRANSCRIPTION_MODEL?.trim() || "openai/gpt-4o-mini-transcribe",
  };
}

export function createConfiguredAiProvider(env: NodeJS.ProcessEnv = process.env) {
  const config = getAiRuntimeConfig(env);
  if (config.name === "lovable") {
    return { config, provider: createLovableAiGatewayProvider(config.apiKey) };
  }
  return {
    config,
    provider: createOpenAICompatible({
      name: "openai",
      baseURL: config.baseURL,
      headers: config.headers,
    }),
  };
}

export function createLovableAiGatewayProvider(lovableApiKey: string, initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (v: string | undefined) => void = () => {};
  let resolved = false;
  const ready = new Promise<string | undefined>((res) => {
    resolveRunId = res;
  });
  const publish = (v?: string) => {
    const n = v?.trim() || undefined;
    if (!runId && n) runId = n;
    if (!resolved) {
      resolved = true;
      resolveRunId(runId);
    }
  };
  if (runId) publish(runId);

  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER))
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      try {
        const res = await fetch(input, { ...init, headers });
        publish(res.headers.get(LOVABLE_AIG_RUN_ID_HEADER) ?? undefined);
        return res;
      } catch (e) {
        publish(undefined);
        throw e;
      }
    },
  });
  return Object.assign(provider, {
    getRunId: () => runId,
    waitForRunId: () => (runId ? Promise.resolve(runId) : ready),
  });
}
