import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("API", () => {
  it("GET /health — memory store", async () => {
    const res = await request(app).get("/health");
    expect(res.body.database).toBe("memory");
    expect(res.body.ok).toBe(true);
  });
});
