import { deviceTimeZone, formatDateInTz, formatWatchedDate, localISODate, tzLabelIfDifferent } from "../formatDate";

// 19:30 UTC on 6 Oct is 01:00 on 7 Oct in Kolkata, still the 6th in London.
const INSTANT = "2026-10-06T19:30:00Z";

describe("formatDateInTz", () => {
  it("formats the instant's day in the given zone", () => {
    expect(formatDateInTz(INSTANT, "Asia/Kolkata")).toBe("07-10-2026");
    expect(formatDateInTz(INSTANT, "Europe/London")).toBe("06-10-2026");
  });

  it("treats a zone alias like its canonical name", () => {
    expect(formatDateInTz(INSTANT, "Asia/Calcutta")).toBe("07-10-2026");
  });

  it.each(["", null, undefined, "Mars/Olympus_Mons"])("falls back to the device zone for %p", (tz) => {
    expect(formatDateInTz(INSTANT, tz)).toBe(formatDateInTz(INSTANT, deviceTimeZone()));
  });
});

describe("tzLabelIfDifferent", () => {
  it("labels a zone whose offset differs from the device's", () => {
    // UTC+14: no test machine runs in it.
    expect(tzLabelIfDifferent(INSTANT, "Pacific/Kiritimati")).toBe("GMT+14");
  });

  it("shows nothing for the device's own zone", () => {
    expect(tzLabelIfDifferent(INSTANT, deviceTimeZone())).toBe("");
  });

  it.each(["", null, undefined, "not-a-zone"])("shows nothing for a blank or invalid zone (%p)", (tz) => {
    expect(tzLabelIfDifferent(INSTANT, tz)).toBe("");
  });
});

describe("localISODate", () => {
  it("uses the local calendar day, zero-padded", () => {
    expect(localISODate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(localISODate(new Date(2026, 11, 31, 0, 1))).toBe("2026-12-31");
  });
});

describe("formatWatchedDate", () => {
  it("appends the label only when the zone differs", () => {
    expect(formatWatchedDate(INSTANT, "Pacific/Kiritimati")).toBe("07-10-2026 · GMT+14");
    expect(formatWatchedDate(INSTANT, deviceTimeZone())).toBe(formatDateInTz(INSTANT, deviceTimeZone()));
  });
});
