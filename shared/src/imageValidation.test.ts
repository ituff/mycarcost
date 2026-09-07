import { describe, it, expect } from 'vitest';
import { validateImageFile } from './imageValidation';

describe('image file validation', () => {
  it('accepts jpeg under 10MB', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: 5 * 1024 * 1024 }).valid).toBe(true);
  });

  it('accepts png under 10MB', () => {
    expect(validateImageFile({ type: 'image/png', size: 9 * 1024 * 1024 }).valid).toBe(true);
  });

  it('rejects non-image types', () => {
    const r = validateImageFile({ type: 'image/gif', size: 1000 });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('JPEG和PNG');
  });

  it('rejects files over 10MB', () => {
    const r = validateImageFile({ type: 'image/png', size: 10 * 1024 * 1024 + 1 });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('10MB');
  });

  it('rejects empty input', () => {
    expect(validateImageFile({}).valid).toBe(false);
  });
});
