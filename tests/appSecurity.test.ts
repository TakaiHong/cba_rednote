import assert from "node:assert/strict";
import type { Server } from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

const { createApp } = await import("../server/src/app.js");

describe("public dashboard protection", () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    server = createApp({
      dashboardAuth: { username: "operator", password: "test-password" }
    }).listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  it("keeps health checks public while protecting dashboard APIs", async () => {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);

    const scheduler = await fetch(`${baseUrl}/api/jobs/daily-generate`, { method: "POST" });
    assert.equal(scheduler.status, 401);

    const denied = await fetch(`${baseUrl}/api/status`);
    assert.equal(denied.status, 401);
    assert.match(denied.headers.get("www-authenticate") ?? "", /Basic/);

    const authorized = await fetch(`${baseUrl}/api/status`, {
      headers: {
        Authorization: `Basic ${Buffer.from("operator:test-password").toString("base64")}`
      }
    });
    assert.equal(authorized.status, 200);
  });
});
