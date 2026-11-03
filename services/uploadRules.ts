// services/uploadRules.ts
// Rules for the file a user may upload.
// These checks only help the user early. The server must check the file again,
// because anything done in the browser can be bypassed.

export const MAX_UPLOAD_MB = 10;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const ALLOWED_EXTENSIONS = [".pdf", ".docx"];
// An old Word file. The server cannot read it yet, so it is refused here with its own message.
const OLD_WORD_EXTENSION = ".doc";

// The two things we need from a File, so this can also be tested with plain objects.
export interface UploadCandidate {
  name: string;
  size: number;
}

// Returns null when the file is fine, otherwise a message that can be shown to the user.
export function validateUploadFile(file: UploadCandidate): string | null {
  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));

  if (lowerName.endsWith(OLD_WORD_EXTENSION)) {
    return `"${file.name}" is an old Word file (.doc), which cannot be read yet. Please open it in Word and save it as .docx or as a PDF.`;
  }

  if (hasAllowedExtension === false) {
    return `"${file.name}" is not a PDF or Word document. Please choose a .pdf or .docx file.`;
  }

  if (file.size === 0) {
    return `"${file.name}" is empty. Please choose a different file.`;
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    // Rounded up, so a file just over the limit never shows as exactly "10.0 MB".
    const sizeInMb = (Math.ceil((file.size / (1024 * 1024)) * 10) / 10).toFixed(1);
    return `"${file.name}" is ${sizeInMb} MB. The limit is ${MAX_UPLOAD_MB} MB. Please choose a smaller file.`;
  }

  return null;
}
