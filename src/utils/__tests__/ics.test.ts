import { buildIcs, foldLine, icsText } from "../ics";

const NOW = new Date("2026-10-08T09:30:00Z");
const octets = (s: string) => Buffer.byteLength(s, "utf8");
/** RFC 5545 unfolding: drop each CRLF followed by one space. */
const unfold = (s: string) => s.replace(/\r\n /g, "");

describe("icsText", () => {
  it("escapes backslash, semicolon, comma and line breaks", () => {
    expect(icsText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });
});

describe("foldLine", () => {
  it("leaves a short line alone", () => {
    expect(foldLine("SUMMARY:Short")).toBe("SUMMARY:Short");
  });

  it("folds at 75 octets, multibyte-safe, and unfolds back exactly", () => {
    const line = "SUMMARY:" + "Ünïcødé ☃ 映画 ".repeat(15);
    const folded = foldLine(line);
    for (const physical of folded.split("\r\n")) expect(octets(physical)).toBeLessThanOrEqual(75);
    expect(unfold(folded)).toBe(line);
    expect(folded).not.toMatch(/�/);
  });
});

describe("buildIcs", () => {
  const groups = [
    {
      date: "2026-10-10",
      items: [
        { id: 1, type: "movie" as const, title: "Crime, Inc.; Part 1\nThe Return" },
        { id: 2, type: "tv" as const, title: "Plain Show" },
      ],
    },
    { date: "2026-10-11", items: [{ id: 3, type: "movie" as const, title: "A".repeat(200) }] },
  ];

  it("stamps every event", () => {
    const ics = unfold(buildIcs(groups, NOW));
    const events = ics.split("BEGIN:VEVENT").slice(1);
    expect(events).toHaveLength(3);
    for (const e of events) expect(e).toContain("DTSTAMP:20261008T093000Z");
  });

  it("keeps a title with special characters on one escaped logical line", () => {
    const lines = unfold(buildIcs(groups, NOW)).split("\r\n");
    expect(lines).toContain("SUMMARY:Crime\\, Inc.\\; Part 1\\nThe Return (Movie)");
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(3);
  });

  it("folds long lines and uses CRLF throughout", () => {
    const ics = buildIcs(groups, NOW);
    for (const physical of ics.split("\r\n")) expect(octets(physical)).toBeLessThanOrEqual(75);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(unfold(ics)).toContain(`SUMMARY:${"A".repeat(200)} (Movie)`);
  });
});
