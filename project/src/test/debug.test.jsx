import { describe, it, expect, vi } from "vitest";

describe("Debug fetch mock", () => {
  it("globalThis handlers work", async () => {
    globalThis.__fetchHandlers = { "/test": [{ id: 1, name: "hello" }] };
    
    const resp = await global.fetch("http://localhost:8000/test");
    const data = await resp.json();
    console.log("FETCH RESULT:", data);
    expect(data).toEqual([{ id: 1, name: "hello" }]);
  });

  it("items/unfiled path works", async () => {
    globalThis.__fetchHandlers["/items/unfiled"] = [{ id: "x", title: "Test" }];
    
    const resp = await global.fetch("http://localhost:8000/items/unfiled", {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: "Bearer fake" },
    });
    const data = await resp.json();
    console.log("UNFILED RESULT:", data);
    expect(data).toEqual([{ id: "x", title: "Test" }]);
  });
});
