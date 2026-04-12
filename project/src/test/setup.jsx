import { vi } from "vitest";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// Mock MSAL (Azure auth)
// ---------------------------------------------------------------------------
vi.mock("../authConfig", () => ({
  msalInstance: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getAllAccounts: vi.fn(() => [{ username: "test@example.com" }]),
    acquireTokenSilent: vi.fn().mockResolvedValue({ accessToken: "fake-token-123" }),
    acquireTokenPopup: vi.fn().mockResolvedValue({ accessToken: "fake-token-123" }),
  },
  protectedResources: {
    todoListApi: { scopes: ["api://test/.default"] },
  },
}));

// ---------------------------------------------------------------------------
// Mock framer-motion (renders children without animation)
// ---------------------------------------------------------------------------
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_, tag) => {
        const Component = ({ children, ...props }) => {
          const { initial, animate, exit, transition, whileHover, whileTap, variants, layout, ...rest } = props;
          const Tag = typeof tag === "string" ? tag : "div";
          return <Tag {...rest}>{children}</Tag>;
        };
        Component.displayName = `motion.${String(tag)}`;
        return Component;
      },
    }
  ),
  AnimatePresence: ({ children }) => <>{children}</>,
  useAnimation: () => ({ start: vi.fn(), set: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Mock global fetch (configurable per-test via globalThis.__fetchHandlers)
// ---------------------------------------------------------------------------
globalThis.__fetchHandlers = {};

const defaultFetchHandler = async (url, options) => {
  const urlStr = typeof url === "string" ? url : url.toString();
  const path = new URL(urlStr, "http://localhost:8000").pathname;

  const handlers = globalThis.__fetchHandlers || {};

  // Try exact match first, then prefix match
  let handler = handlers[path];
  if (!handler) {
    const keys = Object.keys(handlers);
    for (const key of keys) {
      if (path.startsWith(key)) {
        handler = handlers[key];
        break;
      }
    }
  }

  if (handler) {
    const result = typeof handler === "function" ? handler(url, options) : handler;
    return {
      ok: true,
      status: 200,
      json: async () => result,
      text: async () => JSON.stringify(result),
    };
  }
  return { ok: true, status: 200, json: async () => [], text: async () => "[]" };
};

global.fetch = vi.fn(defaultFetchHandler);

// Reset fetch handlers between tests
beforeEach(() => {
  globalThis.__fetchHandlers = {};
  global.fetch.mockImplementation(defaultFetchHandler);
});

afterEach(() => {
  vi.clearAllMocks();
});
