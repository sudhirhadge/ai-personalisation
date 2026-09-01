/**
 * Pure validation functions shared between CreateSessionForm and
 * ImageUploader. Previously these checks were duplicated informally: the
 * email regex lived inline in CreateSessionForm.jsx, and the image
 * type/size checks lived inline in PersonalizeNow.jsx, each written
 * separately from the (unenforceable, since it's a comment) backend rule
 * described in storageController.js.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Must match storageController.js's multer mimetype whitelist exactly —
// this is a fast client-side fail, the backend is still the source of truth.
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB, matches multer's limit

export function isValidEmail(email: string): boolean {
    return EMAIL_REGEX.test(email);
}

export function isAllowedImageType(file: File): boolean {
    return ALLOWED_IMAGE_TYPES.includes(file.type);
}

export function isWithinSizeLimit(file: File): boolean {
    return file.size <= MAX_IMAGE_SIZE_BYTES;
}
