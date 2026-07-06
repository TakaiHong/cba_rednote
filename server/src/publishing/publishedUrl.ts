export function normalizePublishedUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function resolvePublishedUrlEvidence(input: {
  status?: string;
  publishedUrl?: string;
  existingPublishedUrl?: string;
}) {
  const hasUrlPatch = input.publishedUrl !== undefined;
  const nextPublishedUrl = hasUrlPatch
    ? normalizePublishedUrl(input.publishedUrl)
    : normalizePublishedUrl(input.existingPublishedUrl);

  if (hasUrlPatch && input.publishedUrl?.trim() && !nextPublishedUrl) {
    return {
      ok: false,
      error: "publishedUrl must be a valid http(s) URL."
    };
  }

  if (input.status === "published" && !nextPublishedUrl) {
    return {
      ok: false,
      error: "Marking a post as published requires a valid publishedUrl."
    };
  }

  return {
    ok: true,
    publishedUrl: hasUrlPatch ? nextPublishedUrl : undefined
  };
}
