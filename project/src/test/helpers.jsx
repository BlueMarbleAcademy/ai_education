import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * Register a mock response for a given API path.
 */
export function mockApiFetch(path, response) {
  if (!globalThis.__fetchHandlers) globalThis.__fetchHandlers = {};
  globalThis.__fetchHandlers[path] = response;
}

/**
 * Render a component wrapped in MemoryRouter for route-dependent components.
 */
export function renderWithRouter(ui, { route = "/" } = {}) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

/**
 * Factory: creates a mock folder object.
 */
export function makeMockFolder(overrides = {}) {
  return {
    id: overrides.id || `folder-${Math.random().toString(36).slice(2)}`,
    name: overrides.name || "Test Folder",
    color: overrides.color || "from-indigo-100 to-indigo-200",
    parentFolderId: overrides.parentFolderId || null,
    starred: overrides.starred || false,
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || null,
    items: overrides.items ?? 0,
    ...overrides,
  };
}

/**
 * Factory: creates a mock content item.
 */
export function makeMockItem(overrides = {}) {
  return {
    id: overrides.id || `item-${Math.random().toString(36).slice(2)}`,
    userId: overrides.userId || "test-user-123",
    title: overrides.title || "Test Item",
    description: overrides.description || "",
    contentType: overrides.contentType || "quiz",
    folderId: overrides.folderId || null,
    data: overrides.data || {},
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || null,
    ...overrides,
  };
}

/**
 * Get all calls to fetch that match a given path pattern.
 */
export function getFetchCalls(pathPattern) {
  return global.fetch.mock.calls.filter(([url]) => {
    const s =
      typeof url === "string"
        ? url
        : url && typeof url.url === "string"
          ? url.url
          : String(url ?? "");
    return s.includes(pathPattern);
  });
}

/**
 * Get the JSON body from a fetch call.
 */
export function getFetchBody(call) {
  const options = call[1] || {};
  if (options.body) return JSON.parse(options.body);
  return null;
}
