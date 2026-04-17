export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ALLOWED_EXTENSIONS = [".stl", ".obj"];

export function validate3DFile(file: File): ValidationResult {
  const fileName = file.name.toLowerCase();
  
  // Check extension
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  if (!hasValidExtension) {
    return {
      isValid: false,
      error: `Invalid file type. Only ${ALLOWED_EXTENSIONS.join(", ")} files are supported.`,
    };
  }

  // Check size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File size exceeds the ${MAX_FILE_SIZE_MB}MB limit.`,
    };
  }

  return { isValid: true };
}
