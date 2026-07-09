export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Very weak" | "Weak" | "Fair" | "Strong" | "Very strong";
};

const LABELS = ["Very weak", "Weak", "Fair", "Strong", "Very strong"] as const;

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: LABELS[0] };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  const clamped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  return { score: clamped, label: LABELS[clamped] };
}
