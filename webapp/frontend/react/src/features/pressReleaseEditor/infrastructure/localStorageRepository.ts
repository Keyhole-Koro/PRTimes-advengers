export function getStoredString(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(key);
}

export function setStoredString(key: string, value: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, value);
}

export function getStoredJson<T>(key: string, parser: (value: unknown) => T, fallback: T): T {
  const raw = getStoredString(key);
  if (!raw) {
    return fallback;
  }

  try {
    return parser(JSON.parse(raw) as unknown);
  } catch {
    return fallback;
  }
}

export function setStoredJson(key: string, value: unknown): void {
  setStoredString(key, JSON.stringify(value));
}
