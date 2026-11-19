import { randomUUID } from "node:crypto";
import { z } from "zod";
import { summarize, type Entry, type Mess, type Period, type Person } from "./domain";

const key = z.string().min(1).max(90);
const date = z.iso.date();
const units = z.number().int().min(0).max(10000);
const money = z.number().int().min(1).max(100000000);
const signed = z.number().int().min(-100000000).max(100000000);
const base = z.object({ date, note: z.string().max(500).optional() });
const entry = z.discriminatedUnion("kind", [
  base.extend({ kind: z.literal("meal"), counts: z.record(key, z.object({ breakfast: units, lunch: units, dinner: units })) }),
  base.extend({ kind: z.literal("deposit"), amounts: z.record(key, signed) }),
  base.extend({ kind: z.literal("food"), cost: money, shoppers: z.array(key).min(1).max(100) }),
  base.extend({ kind: z.literal("individual"), amounts: z.record(key, money) }),
  base.extend({ kind: z.literal("shared"), cost: money, amounts: z.record(key, signed.min(0)) }),
]);
export const importSchema = z.object({
  name: key,
  start: date,
  members: z.array(z.object({ key, name: key, email: z.email().optional(), invite: z.hash("sha256").optional() })).min(1).max(100),
  entries: z.array(entry).min(1).max(1000),
  balances: z.record(key, signed),
});

export function importLedger(mess: Mess, input: z.infer<typeof importSchema>, manager: Person, today: string): string | undefined {
  if (mess.people.length !== 1 || mess.periods.length > 1 || mess.periods.some(p => p.entries.length || Object.keys(p.opening).length) || mess.requests.length || mess.bazar.length) {
    return "Import requires a new mess with an empty ledger and only the manager.";
  }
  if (input.members.filter(person => !person.email).length !== 1 ||
      new Set(input.members.map(person => person.key)).size !== input.members.length ||
      new Set(input.members.map(person => person.email?.toLowerCase() ?? manager.email)).size !== input.members.length ||
      input.members.some(person => !!person.email !== !!person.invite)) return "Check the imported member accounts.";
  const createdAt = new Date().toISOString();
  const ids = new Map<string, string>();
  const people: Person[] = input.members.map(person => {
    const member: Person = person.email
      ? { id: randomUUID(), name: person.name, email: person.email.toLowerCase(), permissions: [], invite: person.invite, joinedAfter: createdAt }
      : manager;
    ids.set(person.key, member.id);
    return member;
  });
  const period: Period = { id: mess.periods[0]?.id ?? randomUUID(), name: input.name, start: input.start, entries: [], opening: {} };
  if (period.start > today) return "The imported period starts in the future.";
  const mealDays = new Set<string>();
  for (const row of input.entries) {
    if (row.date < period.start || row.date > today) return "An imported entry is outside the period.";
    const keys = "counts" in row ? Object.keys(row.counts) : "amounts" in row ? Object.keys(row.amounts) : row.shoppers;
    if (!keys.length || new Set(keys).size !== keys.length || keys.some(key => !ids.has(key))) return "An entry has invalid member references.";
    const item: Entry = { id: randomUUID(), actor: manager.id, createdAt, date: row.date, kind: row.kind, note: row.note };
    if ("counts" in row) {
      if (mealDays.has(row.date)) return "The import contains duplicate meal days.";
      mealDays.add(row.date);
      item.counts = Object.fromEntries(Object.entries(row.counts).map(([key, value]) => [ids.get(key)!, value]));
    }
    if ("amounts" in row) item.amounts = Object.fromEntries(Object.entries(row.amounts).map(([key, value]) => [ids.get(key)!, value]));
    if ("cost" in row) item.cost = row.cost;
    if ("shoppers" in row) item.shoppers = row.shoppers.map(key => ids.get(key)!);
    if (row.kind === "shared") {
      const amounts = Object.values(row.amounts);
      if (amounts.reduce((sum, amount) => sum + amount, 0) !== row.cost ||
          amounts.some(amount => Math.abs(amount - row.cost / amounts.length) >= 1)) return "An imported shared expense does not reconcile.";
    }
    period.entries.push(item);
  }
  const summary = summarize(period, people);
  if (Object.keys(input.balances).length !== people.length ||
      [...ids].some(([key, id]) => input.balances[key] !== summary.members[id].balance)) return "Balances differ from the source report. Nothing was saved.";
  mess.people = people;
  mess.periods = [period];
}
