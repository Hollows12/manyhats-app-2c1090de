import { describe, expect, it } from "vitest";
import { bearerToken } from "../concept-image";

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
