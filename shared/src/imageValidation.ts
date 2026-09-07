/**
 * Image file validation: MIME type and size limits for recognition upload.
 */
import {
  IMAGE_MAX_SIZE_BYTES,
  IMAGE_ALLOWED_MIME_TYPES,
} from './validation';

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageFile(file: { type?: string; size?: number }): ImageValidationResult {
  if (!file || !file.type) {
    return { valid: false, error: '请选择图片文件' };
  }
  if (!IMAGE_ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: '仅支持JPEG和PNG格式的图片' };
  }
  if (file.size === undefined || file.size <= 0) {
    return { valid: false, error: '图片文件为空' };
  }
  if (file.size > IMAGE_MAX_SIZE_BYTES) {
    return { valid: false, error: '图片大小不能超过10MB' };
  }
  return { valid: true };
}
