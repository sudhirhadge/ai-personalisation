import { describe, expect, it } from 'vitest';
import { isAllowedImageType, isValidEmail, isWithinSizeLimit } from './validation';

function makeFile(type: string, sizeBytes: number): File {
    return new File([new Uint8Array(sizeBytes)], 'test-file', { type });
}

describe('isValidEmail', () => {
    it('accepts a well-formed email', () => {
        expect(isValidEmail('user@example.com')).toBe(true);
    });

    it('rejects a string with no @', () => {
        expect(isValidEmail('not-an-email')).toBe(false);
    });

    it('rejects an empty string', () => {
        expect(isValidEmail('')).toBe(false);
    });
});

describe('isAllowedImageType', () => {
    it('accepts jpeg/png/webp', () => {
        expect(isAllowedImageType(makeFile('image/jpeg', 100))).toBe(true);
        expect(isAllowedImageType(makeFile('image/png', 100))).toBe(true);
        expect(isAllowedImageType(makeFile('image/webp', 100))).toBe(true);
    });

    it('rejects other mime types', () => {
        expect(isAllowedImageType(makeFile('application/pdf', 100))).toBe(false);
    });
});

describe('isWithinSizeLimit', () => {
    it('accepts a file under the 10MB limit', () => {
        expect(isWithinSizeLimit(makeFile('image/png', 1024))).toBe(true);
    });

    it('rejects a file over the 10MB limit', () => {
        expect(isWithinSizeLimit(makeFile('image/png', 11 * 1024 * 1024))).toBe(false);
    });
});
