import { hashPin, verifyPin } from './pin-hash.util';

describe('pin-hash.util', () => {
  it('should hash a pin to a fixed-length hex string', async () => {
    const hash = await hashPin('1234');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should produce the same hash for the same pin', async () => {
    const hash1 = await hashPin('1234');
    const hash2 = await hashPin('1234');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different pins', async () => {
    const hash1 = await hashPin('1234');
    const hash2 = await hashPin('4321');
    expect(hash1).not.toBe(hash2);
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
