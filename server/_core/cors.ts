type CorsEnvironment = Record<string, string | undefined>;

const DEFAULT_ALLOWED_ORIGINS = [
  "https://agenthub-gkta8g2i.manus.space",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
];

function normalizeOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Returns only explicit public/local application origins; never reflects an arbitrary request Origin. */
export function getAllowedCorsOrigins(environment: CorsEnvironment = process.env) {
  const configured = (environment.CORS_ALLOWED_ORIGINS ?? "").split(",");
  const candidates = [
    ...DEFAULT_ALLOWED_ORIGINS,
    environment.EXPO_PACKAGER_PROXY_URL,
    environment.EXPO_WEB_PREVIEW_URL,
    ...configured,
  ];
  return new Set(candidates.map(normalizeOrigin).filter((origin): origin is string => Boolean(origin)));
}

export function isAllowedCorsOrigin(origin: string | undefined, environment: CorsEnvironment = process.env) {
  const normalized = normalizeOrigin(origin);
  return Boolean(normalized && getAllowedCorsOrigins(environment).has(normalized));
}
