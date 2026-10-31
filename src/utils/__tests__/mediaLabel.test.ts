import { mediaLabel } from "../mediaLabel";

describe("mediaLabel", () => {
  it("keeps a stored title", () => {
    expect(mediaLabel("The Matrix", 603)).toBe("The Matrix");
  });

  it.each(["", "   ", null, undefined])("falls back to the id for %p", (title) => {
    expect(mediaLabel(title, 603)).toBe("Untitled (#603)");
  });
});
