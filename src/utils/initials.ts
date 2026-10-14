/** Fallback avatar text: first + last initial, else the first two letters of the first name or username. */
export function getInitials(user: { first_name?: string; last_name?: string; username: string }): string {
  const f = user.first_name?.trim() ?? "";
  const l = user.last_name?.trim() ?? "";
  if (f && l) return (f[0]! + l[0]!).toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  return user.username.slice(0, 2).toUpperCase();
}
