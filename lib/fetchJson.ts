export async function readJsonResponse<T = any>(
  response: Response,
  label = "Request",
) {
  const text = await response.text();
  const trimmed = text.trim();

  if (!trimmed) return {} as T;

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const contentType = response.headers.get("content-type") ?? "unknown";
    const preview = trimmed.replace(/\s+/g, " ").slice(0, 120);

    throw new Error(
      `${label} returned ${contentType} instead of JSON (${response.status}). ${preview}`,
    );
  }
}
