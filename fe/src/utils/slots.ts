import type * as models from "../models";

type Slot = typeof models.SlotBase.infer;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function localDateKey(d: Date) {
  // Local calendar date: YYYY-MM-DD in the runtime's local timezone
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function groupSlotsByLocalStartDate(slots: Slot[]) {
  return slots.reduce<Record<string, Slot[]>>((acc, slot) => {
    const key = localDateKey(slot.starts_at);
    const array = acc[key];
    if (array) {
      array.push(slot);
    } else {
      acc[key] = [slot];
    }
    return acc;
  }, {});
}

export function groupSlotsByLocalStartDateSorted(slots: Slot[]) {
  const grouped = groupSlotsByLocalStartDate(slots);

  for (const key of Object.keys(grouped)) {
    grouped[key].sort(
      (a, b) => a.starts_at.getTime() - b.starts_at.getTime(),
    );
  }

  // Keys are YYYY-MM-DD, so lexicographic sort == chronological sort
  return Object.fromEntries(
    Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)),
  ) as Record<string, Slot[]>;
}
