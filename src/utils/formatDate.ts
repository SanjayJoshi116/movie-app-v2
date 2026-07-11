export function formatDateDMY(dateStr: string): string {
  const [yyyy, mm, dd] = (dateStr.split("T")[0] ?? "").split("-");
  if (yyyy && mm && dd) return `${dd}-${mm}-${yyyy}`;
  const date = new Date(dateStr);
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}
