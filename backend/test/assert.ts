// Small adapters so the tests ported from Deno keep their original assertions.
import { expect } from 'vitest';

export function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  expect(actual, msg).toEqual(expected);
}

export function assert(condition: unknown, msg?: string): asserts condition {
  expect(condition, msg).toBeTruthy();
}

export function assertThrows(fn: () => unknown): void {
  expect(fn).toThrow();
}
