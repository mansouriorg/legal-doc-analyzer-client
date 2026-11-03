// services/previewRules.ts
// Which uploaded files the results page can show in its preview frame.
//
// A browser shows a PDF inside a frame. For a Word file (.doc or .docx) it starts a
// download instead, so those files get a short message and no frame.

// Only the name is needed, so this can also be tested with plain objects.
export function canPreviewFile(file: { name: string }): boolean {
  return file.name.toLowerCase().endsWith(".pdf");
}
