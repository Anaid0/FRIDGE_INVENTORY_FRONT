import { describe, expect, it } from 'vitest';
import { isNative, keepScreenOn, showSystemBars } from './platform';

describe('platform (navegador)', () => {
  it('no es nativo y las integraciones no hacen nada ni fallan', async () => {
    expect(isNative()).toBe(false);
    await expect(keepScreenOn(true)).resolves.toBeUndefined();
    await expect(showSystemBars()).resolves.toBeUndefined();
  });
});
