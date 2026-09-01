// Waits a macrotask tick so pending microtasks (e.g. chained storage promises) resolve first.
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
