/** A library title for display, or "Untitled (#<id>)" when the stored title is
 *  blank (a bulk import can store one without a name). */
export function mediaLabel(title: string | null | undefined, id: number): string {
  return title?.trim() || `Untitled (#${id})`;
}
