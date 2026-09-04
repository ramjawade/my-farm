import { hashPin, verifyPin } from './pin-hash.util';

describe('pin-hash.util', () => {
  it('should hash a pin to a salted pbkdf2 string', async () => {
    const hash = await hashPin('1234');
    expect(hash).toMatch(/^pbkdf2\$\d+\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
  });

  it('should produce different hashes for the same pin (random salt)', async () => {
    const hash1 = await hashPin('1234');
    const hash2 = await hashPin('1234');
    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hashes for different pins', async () => {
    const hash1 = await hashPin('1234');
    const hash2 = await hashPin('4321');
    expect(hash1).not.toBe(hash2);
  });

  it('should verify a pin against a legacy unsalted sha-256 hash', async () => {
    const legacyHash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode('9012')),
      ),
    )
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(await verifyPin('9012', legacyHash)).toBeTrue();
    expect(await verifyPin('0000', legacyHash)).toBeFalse();
  });

  it('should verify a correct pin', async () => {
    const hash = await hashPin('5678');
    const result = await verifyPin('5678', hash);
    expect(result).toBeTrue();
  });

  it('should reject an incorrect pin', async () => {
    const hash = await hashPin('5678');
    const result = await verifyPin('0000', hash);
    expect(result).toBeFalse();
  });
});
