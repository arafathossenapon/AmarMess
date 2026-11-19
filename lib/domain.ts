export const slots = ["breakfast", "lunch", "dinner"] as const;
export type Counts = Record<typeof slots[number], number>;
export type Permission = "deposit" | "meal" | "expense";
export type Person = {
  id: string; name: string; email: string; phone?: string; permissions: Permission[];
  invite?: string; joinedAfter?: string; autoSince?: string; defaults?: Counts; auto?: boolean;
};
export type Entry = {
  id: string; date: string; kind: "deposit" | "meal" | "food" | "shared" | "individual";
  note?: string; amounts?: Record<string, number>; counts?: Record<string, Counts>;
  cost?: number; shoppers?: string[]; credits?: Record<string, number>;
  actor: string; createdAt: string;
};
export type Period = {
  id: string; name: string; start: string; end?: string; entries: Entry[];
  opening: Record<string, number>;
};
export type MealRequest = { member: string; date: string; counts: Counts; status: "pending" | "approved" | "declined"; period: string };
export type Bazar = { member: string; date: string; period: string };
export type Mess = {
  name: string; manager: string; people: Person[]; periods: Period[];
  requests: MealRequest[]; bazar: Bazar[]; cutoff: string;
};
export const zero: Counts = { breakfast: 0, lunch: 0, dinner: 0 };
export const activePeriod = (mess: Mess) => mess.periods.at(-1);
export const totalMeals = (counts: Counts) => slots.reduce((sum, slot) => sum + counts[slot], 0);
export const money = (value: number) => `৳${(value / 100).toLocaleString("en-BD", {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
export const quantity = (value: number) => (value / 100).toFixed(2);
export const kindLabels = { meal: "Meals", deposit: "Deposits", food: "Meal costs", shared: "Shared costs", individual: "Individual costs" };
export function dhakaNow() {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts().map(part => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}
export function split(total: number, weights: Record<string, number>) {
  const divisor = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  if (!divisor) return {};
  const shares = Object.entries(weights).map(([id, weight]) => {
    const numerator = BigInt(total) * BigInt(weight);
    return { id, amount: Number(numerator / BigInt(divisor)), remainder: Number(numerator % BigInt(divisor)) };
  }).sort((a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id));
  const extra = total - shares.reduce((sum, share) => sum + share.amount, 0);
  return Object.fromEntries(shares.map((share, index) => [share.id, share.amount + Number(index < extra)]));
}
export function summarize(period: Period, people: Person[]) {
  const members = Object.fromEntries(people.map(person => [person.id, {
    meals: 0, deposits: 0, opening: period.opening[person.id] ?? 0,
    food: 0, shared: 0, individual: 0, expense: 0, balance: 0,
  }]));
  let food = 0;
  for (const entry of period.entries) {
    if (entry.kind === "food") food += entry.cost ?? 0;
    for (const [id, counts] of Object.entries(entry.counts ?? {})) members[id].meals += totalMeals(counts);
    for (const [id, amount] of Object.entries(entry.credits ?? {})) members[id].deposits += amount;
    for (const [id, amount] of Object.entries(entry.amounts ?? {})) {
      if (entry.kind === "deposit") members[id].deposits += amount;
      if (entry.kind === "shared" || entry.kind === "individual") members[id][entry.kind] += amount;
    }
  }
  const rows = Object.entries(members);
  const meals = rows.reduce((sum, [, member]) => sum + member.meals, 0);
  const shares = split(food, Object.fromEntries(rows.map(([id, member]) => [id, member.meals])));
  const totals = { meals, food, deposits: 0, opening: 0, shared: 0, individual: 0, balance: 0, rate: meals ? food * 100 / meals : 0 };
  for (const [id, member] of rows) {
    member.food = shares[id] ?? 0;
    member.expense = member.food + member.shared + member.individual;
    member.balance = member.opening + member.deposits - member.expense;
    for (const key of ["deposits", "opening", "shared", "individual"] as const) totals[key] += member[key];
  }
  totals.balance = totals.opening + totals.deposits - totals.food - totals.shared - totals.individual;
  return { members, totals };
}


