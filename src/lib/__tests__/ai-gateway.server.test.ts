import { afterEach, describe, expect, it } from "vitest";
import { getAiRuntimeConfig } from "../ai-gateway.server";

describe("AI provider configuration", () => {
  afterEach(() => {
    delete process.env.AI_PROVIDER;
  });

  it("defaults to OpenAI and never silently falls back", () => {
    expect(() => getAiRuntimeConfig({})).toThrow("Missing OPENAI_API_KEY");
  });

  it("uses OpenAI when configured", () => {
    const config = getAiRuntimeConfig({ OPENAI_API_KEY: "test-key" });
    expect(config.name).toBe("openai");
    expect(config.baseURL).toBe("https://api.openai.com/v1");
    expect(config.chatModel).toBe("gpt-5.4-mini");
  });

  it("allows Lovable only when explicitly selected", () => {
    const config = getAiRuntimeConfig({
      AI_PROVIDER: "lovable",
      LOVABLE_API_KEY: "test-key",
    });
    expect(config.name).toBe("lovable");
    expect(config.baseURL).toBe("https://ai.gateway.lovable.dev/v1");
  });

  it("rejects unknown providers", () => {
    expect(() => getAiRuntimeConfig({ AI_PROVIDER: "other" })).toThrow("AI_PROVIDER");
  });
});
