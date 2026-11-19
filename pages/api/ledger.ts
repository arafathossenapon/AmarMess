import express from "express";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { auth, createMess, readMess, writeMess } from "../../lib/store";
import { importLedger, importSchema } from "../../lib/ledger-import";
import { hashCode } from "../../lib/invite";
import { activePeriod, dhakaNow, split, summarize, type Entry, type Mess, type Permission } from "../../lib/domain";

export const config = { api: { bodyParser: false, responseLimit: false } };
const api = express();
api.disable("x-powered-by");
api.use(express.json({ limit: "128kb" }));
api.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

const id = z.string().uuid();
const date = z.iso.date();
const title = z.string().trim().min(2).max(90);
const units = z.number().int().min(0).max(10000);
const counts = z.object({ breakfast: units, lunch: units, dinner: units });
const cash = z.number().int().min(1).max(100000000);
const text = z.string().max(500).optional();
const permissions = z.array(z.enum(["deposit", "meal", "expense"])).max(3);
const actions = z.discriminatedUnion("op", [
  z.object({ op: z.literal("setup"), name: title }),
  z.object({ op: z.literal("import"), ledger: importSchema }),
  z.object({ op: z.literal("settings"), name: title }),
  z.object({ op: z.literal("period"), name: title, start: date, carry: z.boolean() }),
  z.object({ op: z.literal("rename"), name: title }),
  z.object({ op: z.literal("member"), name: title, email: z.email().max(254), phone: z.string().max(32).optional() }),
  z.object({ op: z.literal("permissions"), member: id, permissions }),
  z.object({ op: z.literal("manager"), member: id }),
  z.object({ op: z.literal("profile"), name: title, phone: z.string().max(32) }),
  z.object({ op: z.literal("delete"), name: title }),
  z.object({ op: z.literal("bazar"), member: id, date, remove: z.boolean() }),
  z.object({ op: z.literal("deposit"), date, member: id, amount: z.number().int().min(-100000000).max(100000000), note: text }),
  z.object({ op: z.literal("meal"), date, counts: z.record(id, counts) }),
  z.object({ op: z.literal("food"), date, cost: cash, shoppers: z.array(id).min(1), credit: z.boolean(), note: text }),
  z.object({ op: z.literal("shared"), date, cost: cash, members: z.array(id).min(1), note: text }),
  z.object({ op: z.literal("individual"), date, amounts: z.record(id, cash), note: text }),
  z.object({ op: z.literal("removeEntry"), entry: id }),
]);
class InputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function check(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new InputError(message, status);
}
function publicMess(mess: Mess) {
  return { ...mess, people: mess.people.map(({ invite, ...person }) => person) };
}
api.all("/api/ledger", async (req, res) => {
  const session = await auth().api.getSession({ headers: new Headers(req.headers as Record<string, string>) });
  check(session, "Please sign in.", 401);
  const email = session.user.email.toLowerCase();
  const record = await readMess();
  if (!record) {
    check(email === process.env.MESS_SETUP_EMAIL?.trim().toLowerCase(), "Access denied.", 403);
    if (req.method === "GET") return res.json({ mess: null, user: session.user });
    check(req.method === "POST", "Method not allowed.", 405);
    const payload = actions.parse(req.body);
    check(payload.op === "setup", "Create the mess first.");
    const member = randomUUID();
    const mess: Mess = {
      name: payload.name, manager: member, people: [{ id: member, name: session.user.name, email, permissions: [] }],
      periods: [], requests: [], bazar: [], cutoff: "10:00",
    };
    await createMess(mess);
    return res.json({ mess: publicMess(mess), member });
  }

  const mess = record.data;
  const user = mess.people.find(person => person.email === email);
  check(user, "This account is not a member of the mess.", 403);
  // Accounts invited under a previous incarnation of the mess cannot claim newly issued invitations.
  if (user.invite) {
    const clientSession = session.user.createdAt;
    check(!user.joinedAfter || new Date(clientSession).toISOString() >= user.joinedAfter, "This account predates the current invitation.", 403);
  }
  if (req.method === "GET") return res.json({ mess: publicMess(mess), member: user.id, user: session.user });
  check(req.method === "POST", "Method not allowed.", 405);
  const a = actions.parse(req.body);
  const manager = mess.manager === user.id;
  const allows = (permission: Permission) => manager || user.permissions.includes(permission);
  const manage = () => check(manager, "Only the manager can do this.", 403);
  const member = (key: string) => {
    const person = mess.people.find(person => person.id === key);
    check(person, "Member not found.");
    return person;
  };
  const period = activePeriod(mess);
  const now = dhakaNow();
  const current = () => {
    check(period, "Start an accounting period first.");
    return period;
  };
  const ledgerDate = (day: string) => check(day >= current().start && day <= now.date, "Choose a date in the active period through today.");
  const entry = (data: Omit<Entry, "id" | "actor" | "createdAt">) => {
    ledgerDate(data.date);
    current().entries.push({ ...data, id: randomUUID(), actor: user.id, createdAt: new Date().toISOString() });
  };
  let invitation: string | undefined;
  switch (a.op) {
    case "import": {
      manage();
      const error = importLedger(mess, a.ledger, user, now.date);
      check(!error, error ?? "");
      break;
    }
    case "setup": throw new InputError("The mess already exists.", 409);
    case "settings": manage(); mess.name = a.name; break;
    case "rename": manage(); current().name = a.name; break;
    case "period": {
      manage();
      check(a.start <= now.date, "The start date cannot be in the future.");
      let opening: Record<string, number> = {};
      if (period) {
        check(a.start > period.start && !period.entries.some(row => row.date >= a.start), "Start after the current period and its last ledger entry.");
        const { members, totals } = summarize(period, mess.people);
        check(!totals.food || totals.meals, "Record meals before closing a period with meal costs.");
        const lastDay = new Date(a.start + "T00:00:00Z");
        lastDay.setUTCDate(lastDay.getUTCDate() - 1);
        period.end = lastDay.toISOString().slice(0, 10);
        if (a.carry) opening = Object.fromEntries(Object.entries(members).map(([key, value]) => [key, value.balance]));
      }
      mess.periods.push({ id: randomUUID(), name: a.name, start: a.start, entries: [], opening });
      break;
    }
    case "member": {
      manage();
      const email = a.email.toLowerCase();
      check(!mess.people.some(person => person.email === email), "That email is already on the member list.");
      invitation = randomBytes(18).toString("base64url");
      mess.people.push({ id: randomUUID(), name: a.name, email, phone: a.phone, permissions: [], invite: hashCode(invitation), joinedAfter: new Date().toISOString() });
      break;
    }
    case "permissions": manage(); member(a.member).permissions = [...new Set(a.permissions)]; break;
    case "manager": manage(); mess.manager = member(a.member).id; break;
    case "profile": user.name = a.name; user.phone = a.phone; break;
    case "delete":
      manage();
      check(a.name === mess.name, "Enter the exact mess name.");
      check(await writeMess(record.revision, null), "The ledger changed. Reload and try again.", 409);
      return res.json({ mess: null });
    case "bazar":
      check(manager || a.member === user.id, "You can change your own bazar dates.", 403);
      member(a.member);
      check(a.date >= current().start, "Choose a date in the active period.");
      mess.bazar = mess.bazar.filter(row => row.period !== current().id || row.member !== a.member || row.date !== a.date);
      if (!a.remove) mess.bazar.push({ member: a.member, period: current().id, date: a.date });
      break;
    case "deposit":
      check(allows("deposit"), "Deposit permission required.", 403);
      check(a.amount !== 0, "Enter a nonzero deposit.");
      entry({ kind: "deposit", date: a.date, note: a.note, amounts: { [member(a.member).id]: a.amount } });
      break;
    case "meal": {
      check(allows("meal"), "Meal permission required.", 403);
      check(Object.keys(a.counts).length, "Select at least one member.");
      for (const key of Object.keys(a.counts)) member(key);
      ledgerDate(a.date);
      for (const row of current().entries) {
        if (row.kind === "meal" && row.date === a.date && row.counts) {
          for (const key of Object.keys(a.counts)) delete row.counts[key];
        }
      }
      current().entries = current().entries.filter(row => row.kind !== "meal" || Object.keys(row.counts ?? {}).length);
      entry({ kind: "meal", date: a.date, counts: a.counts });
      break;
    }
    case "food": {
      check(allows("expense"), "Expense permission required.", 403);
      const shoppers = [...new Set(a.shoppers)].map(key => member(key).id);
      const credits = a.credit ? split(a.cost, Object.fromEntries(shoppers.map(key => [key, 1]))) : undefined;
      entry({ kind: "food", date: a.date, note: a.note, cost: a.cost, shoppers, credits });
      break;
    }
    case "shared":
      check(allows("expense"), "Expense permission required.", 403);
      entry({ kind: "shared", date: a.date, note: a.note, cost: a.cost, amounts: split(a.cost, Object.fromEntries(a.members.map(key => [member(key).id, 1]))) });
      break;
    case "individual":
      check(allows("expense"), "Expense permission required.", 403);
      check(Object.keys(a.amounts).length, "Enter an amount for at least one member.");
      Object.keys(a.amounts).forEach(member);
      entry({ kind: "individual", date: a.date, note: a.note, amounts: a.amounts });
      break;
    case "removeEntry":
      manage();
      check(current().entries.some(row => row.id === a.entry), "Entry not found.");
      current().entries = current().entries.filter(row => row.id !== a.entry);
      break;
  }
  check(await writeMess(record.revision, mess), "The ledger changed. Reload and try again.", 409);
  return res.json({ mess: publicMess(mess), member: user.id, invitation });
});
api.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof InputError) return res.status(error.status).json({ error: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ error: "Check " + (error.issues[0]?.path.join(" / ") || "the submitted values") + "." });
  console.error(error instanceof Error ? error.name : "Ledger error");
  return res.status(500).json({ error: "The ledger service is unavailable." });
});
export default api;
