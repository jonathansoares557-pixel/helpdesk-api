import { buildSlots, canTransition, DEFAULT_AVAILABILITY, freeSlots, sumCents } from "../src/lib/schedule";

describe("schedule helpers", () => {
  it("builds default business hours slots", () => {
    expect(buildSlots([[8, 12], [14, 18]])).toEqual(DEFAULT_AVAILABILITY);
  });

  it("removes busy slots", () => {
    expect(freeSlots(["08:00", "09:00", "10:00"], ["09:00"])).toEqual(["08:00", "10:00"]);
  });

  it("sums service prices", () => {
    expect(sumCents([{ priceCents: 5000 }, { priceCents: 7000 }])).toBe(12000);
    expect(sumCents([])).toBe(0);
  });

  it("validates status transitions", () => {
    expect(canTransition("OPEN", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "CLOSED")).toBe(true);
    expect(canTransition("CLOSED", "OPEN")).toBe(false);
    expect(canTransition("IN_PROGRESS", "OPEN")).toBe(false);
  });
});
