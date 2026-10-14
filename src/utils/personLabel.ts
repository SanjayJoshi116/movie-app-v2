/** A person's name for display, or "Person <id>" when the stored name is blank
 *  (a hand-edited backup can restore a follow without one). */
export function personLabel(name: string | null | undefined, id: number): string {
  return name?.trim() || `Person ${id}`;
}
