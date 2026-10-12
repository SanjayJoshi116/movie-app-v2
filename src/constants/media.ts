// Same-origin by default: nginx serves /media in production, and CRA's dev
// `proxy` forwards it to Django.
export const MEDIA_BASE_URL = process.env.REACT_APP_MEDIA_BASE_URL ?? "";

export function resolveAvatarUrl(avatarUrl?: string | null): string | undefined {
  if (!avatarUrl) return undefined;
  return `${MEDIA_BASE_URL}${avatarUrl}`;
}
