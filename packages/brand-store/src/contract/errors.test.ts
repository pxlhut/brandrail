import { describe, expect, it } from 'vitest';

import {
  ConflictError,
  NotFoundError,
  NotSupportedError,
  StoreError,
  VersionConflictError,
} from './errors.js';

describe('the store error hierarchy', () => {
  it.each([
    ['ConflictError', ConflictError],
    ['NotFoundError', NotFoundError],
    ['VersionConflictError', VersionConflictError],
    ['NotSupportedError', NotSupportedError],
  ] as const)('%s is distinguishable from the others via instanceof', (_label, ErrorClass) => {
    const err = new ErrorClass('boom');
    expect(err).toBeInstanceOf(ErrorClass);
    expect(err).toBeInstanceOf(StoreError);
    expect(err).toBeInstanceOf(Error);

    for (const [, Other] of [
      ['ConflictError', ConflictError],
      ['NotFoundError', NotFoundError],
      ['VersionConflictError', VersionConflictError],
      ['NotSupportedError', NotSupportedError],
    ] as const) {
      if (Other === ErrorClass) continue;
      expect(err).not.toBeInstanceOf(Other);
    }
  });

  it('carries its own class name, not the base class name — for logging and messages', () => {
    expect(new ConflictError('x').name).toBe('ConflictError');
    expect(new NotSupportedError('x').name).toBe('NotSupportedError');
  });

  it('forwards the message and an optional cause, same as a plain Error', () => {
    const cause = new Error('underlying');
    const err = new NotFoundError('site not found', { cause });
    expect(err.message).toBe('site not found');
    expect(err.cause).toBe(cause);
  });

  it('cannot construct the base class directly — a caller can only ever throw a specific kind', () => {
    // A compile-time check, not a runtime one: `abstract` is erased from the
    // emitted JS, so this would not throw at runtime — `tsc` is what refuses
    // to compile it, which is the actual guarantee `abstract` provides here.
    // @ts-expect-error StoreError is abstract and cannot be instantiated
    const blocked = new StoreError('x');
    expect(blocked).toBeInstanceOf(Error);
  });
});
