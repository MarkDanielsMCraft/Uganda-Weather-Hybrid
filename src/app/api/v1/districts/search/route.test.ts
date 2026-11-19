import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/v1/districts/search", () => {
  it("returns matching districts for a valid query", async () => {
    const res = await GET(new Request("http://localhost/api/v1/districts/search?q=Kampala"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.results.length).toBeGreaterThan(0);
    expect(body.data.results[0].name).toBe("Kampala");
  });

  it("rejects a query shorter than 2 characters with 400", async () => {
    const res = await GET(new Request("http://localhost/api/v1/districts/search?q=k"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("rejects a missing query with 400", async () => {
    const res = await GET(new Request("http://localhost/api/v1/districts/search"));
    expect(res.status).toBe(400);
  });

  it("returns an empty result set for a query with no matches, not an error", async () => {
    const res = await GET(new Request("http://localhost/api/v1/districts/search?q=zzzznotadistrict"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.results).toEqual([]);
  });
});
