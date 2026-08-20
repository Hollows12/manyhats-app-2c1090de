import { describe, expect, it } from "vitest";
import {
  bearerToken,
  resolveConceptGenerationProfile,
} from "../concept-image";

describe("concept image authentication gate", () => {
  it("rejects a request without an authorization header", () => {
    expect(bearerToken(new Request("https://example.test/api/concept-image"))).toBeNull();
  });

  it("rejects non-Bearer and empty Bearer credentials", () => {
    expect(
      bearerToken(
        new Request("https://example.test/api/concept-image", {
          headers: { authorization: "Basic dXNlcjpwYXNz" },
        }),
      ),
    ).toBeNull();
    expect(
      bearerToken(
        new Request("https://example.test/api/concept-image", {
          headers: { authorization: "Bearer   " },
        }),
      ),
    ).toBeNull();
  });

  it("passes a Bearer token to the server-side claims and RLS checks", () => {
    expect(
      bearerToken(
        new Request("https://example.test/api/concept-image", {
          headers: { authorization: "Bearer signed-session-token" },
        }),
      ),
    ).toBe("signed-session-token");
  });
});


describe("concept generation profiles", () => {
  it("uses the rendering entitlement for ordinary concepts", () => {
    const profile = resolveConceptGenerationProfile("Shared Vision rendering");
    expect(profile.entitlement).toBe("shared_vision_rendering");
    expect(profile.outputKind).toBe("rendering");
    expect(profile.instruction).toContain("ultra-realistic");
  });

  it("uses preliminary plan safeguards for blueprint requests", () => {
    const profile = resolveConceptGenerationProfile(
      "Concept plan / preliminary blueprint package",
    );
    expect(profile.entitlement).toBe("concept_plans");
    expect(profile.outputKind).toBe("concept_plan");
    expect(profile.instruction).toContain("NOT FOR CONSTRUCTION");
    expect(profile.instruction).toContain("Do not invent dimensions");
  });

  it("uses the walkthrough entitlement and continuity instructions", () => {
    const profile = resolveConceptGenerationProfile(
      "Subscriber 3D walkthrough",
    );
    expect(profile.entitlement).toBe("walkthrough_3d");
    expect(profile.outputKind).toBe("walkthrough_preview");
    expect(profile.instruction).toContain("ultra-realistic");
    expect(profile.instruction).toContain("continuity");
  });
});
