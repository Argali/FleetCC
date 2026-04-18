import "@testing-library/jest-dom";
import { server } from "./mocks/server";
import { beforeAll, afterAll, afterEach } from "vitest";

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));

// Reset handlers between tests to avoid state leakage
afterEach(() => server.resetHandlers());

// Stop server after all tests
afterAll(() => server.close());

// Stub browser APIs not present in jsdom
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Stub sessionStorage (already available in jsdom, but ensure clean slate)
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});
