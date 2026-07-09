const API_HOST = window.location.hostname;

export const MEDIA_BASE_URL = process.env.REACT_APP_MEDIA_BASE_URL ?? `http://${API_HOST}:8000`;

export function resolveAvatarUrl(avatarUrl?: string | null): string | undefined {
  if (!avatarUrl) return undefined;
  return `${MEDIA_BASE_URL}${avatarUrl}`;
}
