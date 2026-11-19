import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/v1/districts", () => {
  it("returns all 152 districts with the expected shape", async () => {
    const res = await GET(new Request("http://localhost/api/v1/districts"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.total).toBe(152);
    expect(body.data.districts).toHaveLength(152);
    expect(body.data.districts[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String),
      region: expect.any(String),
    });
    expect(body.meta.requestId).toBeTruthy();
  });

  it("filters by region", async () => {
    const res = await GET(new Request("http://localhost/api/v1/districts?region=central"));
    const body = await res.json();
    expect(body.data.districts.length).toBeGreaterThan(0);
    expect(body.data.districts.every((d: { region: string }) => d.region === "central")).toBe(true);
  });

  it("rejects an invalid region with 400", async () => {
    const res = await GET(new Request("http://localhost/api/v1/districts?region=atlantis"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("sets rate-limit headers on a successful response", async () => {
    const res = await GET(new Request("http://localhost/api/v1/districts"));
    expect(res.headers.get("X-RateLimit-Limit")).toBeTruthy();
    expect(res.headers.get("X-RateLimit-Remaining")).toBeTruthy();
  });
});
