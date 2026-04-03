const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = ["image/", "video/"];

export function validatePost(
  title: string,
  content: string
): string | null {
  const t = title.trim();
  const c = content.trim();

  if (t.length === 0) return "Title is required.";
  if (t.length < 3) return "Title must be at least 3 characters.";
  if (t.length > 300) return `Title must be 300 characters or fewer (currently ${t.length}).`;

  if (c.length === 0) return "Content is required.";
  if (c.length < 10) return "Content must be at least 10 characters.";
  if (c.length > 10_000) return `Content must be 10,000 characters or fewer (currently ${c.length}).`;

  return null;
}

export function validateComment(content: string): string | null {
  const c = content.trim();

  if (c.length === 0) return "Comment cannot be empty.";
  if (c.length > 2_000) return `Comment must be 2,000 characters or fewer (currently ${c.length}).`;

  return null;
}

export function validateMediaFiles(files: File[]): string | null {
  for (const file of files) {
    const isAllowedType = ALLOWED_MEDIA_TYPES.some((t) => file.type.startsWith(t));
    if (!isAllowedType) return `"${file.name}" is not a supported file type.`;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `"${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB size limit.`;
    }
  }
  return null;
}
