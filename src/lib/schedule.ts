import { TicketStatus } from "@prisma/client";

/** Default business hours: 08-12 and 14-18. */
export const DEFAULT_AVAILABILITY = [
  "08:00", "09:00", "10:00", "11:00",
  "14:00", "15:00", "16:00", "17:00",
];

/** Builds the hourly slots for the given [start, end) ranges. */
export function buildSlots(ranges: Array<[number, number]>): string[] {
  const slots: string[] = [];
  for (const [start, end] of ranges) {
    for (let h = start; h < end; h++) slots.push(`${String(h).padStart(2, "0")}:00`);
  }
  return slots;
}

/** Slots of a technician that are not already taken by an active ticket. */
export function freeSlots(availability: string[], busy: string[]): string[] {
  const taken = new Set(busy);
  return [...availability].sort().filter((s) => !taken.has(s));
}

export function sumCents(items: Array<{ priceCents: number }>): number {
  return items.reduce((acc, i) => acc + i.priceCents, 0);
}

const transitions: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "CLOSED"],
  IN_PROGRESS: ["CLOSED"],
  CLOSED: [],
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return transitions[from].includes(to);
}
