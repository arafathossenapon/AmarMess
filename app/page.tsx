"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createAuthClient } from "better-auth/react";
import { ArrowUpRight, Bell, CalendarDays, CircleDollarSign, LayoutDashboard, LogOut, Settings, ShoppingBasket, Soup, UserRound, Users, Wallet } from "lucide-react";
import { activePeriod, dhakaNow, kindLabels, money, quantity, slots, summarize, totalMeals, zero, type Counts, type Entry, type Mess, type Period, type Person } from "../lib/domain";

const auth = createAuthClient();
const nav = [
  ["Overview", LayoutDashboard], ["Deposits", Wallet], ["Meals", Soup], ["Expenses", ShoppingBasket],
  ["Periods", CalendarDays], ["Members", Users], ["Activity", Bell], ["Settings", Settings], ["Profile", UserRound],
] as const;
type Page = typeof nav[number][0];
type Payload = Record<string, unknown>;
type Save = (payload: Payload) => Promise<boolean>;
const number = (value: FormDataEntryValue | null) => Math.round(Number(value ?? 0) * 100);
const values = (form: FormData, prefix = "") => Object.fromEntries(slots.map(slot => [slot, number(form.get(prefix + slot))])) as Counts;
const str = (form: FormData, key: string) => String(form.get(key) ?? "");
const labels = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
const nameOf = (mess: Mess, id: string) => mess.people.find(person => person.id === id)?.name ?? "Member";
const formatDate = (date: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Dhaka" }).format(new Date(date));
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="panel"><h2>{title}</h2>{children}</section>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
function DateField({ value, min, max }: { value?: string; min?: string; max?: string }) {
  return <Field label="Date"><input type="date" name="date" required defaultValue={value ?? dhakaNow().date} min={min} max={max} /></Field>;
}
function MoneyField({ name = "amount", label = "Amount (BDT)", signed = false, required = true }: { name?: string; label?: string; signed?: boolean; required?: boolean }) {
  return <Field label={label}><input name={name} type="number" step="0.01" min={signed ? -1000000 : 0} max={1000000} placeholder="0.00" required={required} /></Field>;
}
function Notes({ label = "Note" }: { label?: string }) {
  return <Field label={label}><textarea name="note" rows={3} maxLength={500} placeholder="Optional" /></Field>;
}
function MealFields({ counts = zero, prefix = "" }: { counts?: Counts; prefix?: string }) {
  return <div className="meal-fields">{slots.map(slot => <Field key={slot} label={labels[slot]}>
    <input name={prefix + slot} type="number" required min="0" max="100" step="0.01" defaultValue={quantity(counts[slot])} />
  </Field>)}</div>;
}
function MemberSelect({ people, name = "member" }: { people: Person[]; name?: string }) {
  return <Field label="Member"><select name={name} required defaultValue=""><option disabled value="">Select a member</option>
    {people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field>;
}
function Check({ name, children, value, checked }: { name: string; children: ReactNode; value?: string; checked?: boolean }) {
  return <label className="check"><input name={name} type="checkbox" value={value} defaultChecked={checked} />{children}</label>;
}
function Form({ children, label, action, save, danger }: { children: ReactNode; label: string; action: (data: FormData) => Payload; save: Save; danger?: boolean }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try { await save(action(new FormData(event.currentTarget))); } finally { setBusy(false); }
  }
  return <form onSubmit={submit}>{children}<button className={danger ? "danger" : "primary"} disabled={busy}>{busy ? "Saving…" : label}</button></form>;
}
function Login({ onLogin, error, setError }: { onLogin: () => Promise<void>; error: string; setError: (error: string) => void }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const credentials = { email: str(form, "email").trim().toLowerCase(), password: str(form, "password") };
    setBusy(true);
    setError("");
    try {
      const result = register
        ? await auth.signUp.email({ ...credentials, name: str(form, "name") }, { headers: { "x-mess-invite": str(form, "code") } })
        : await auth.signIn.email(credentials);
      if (result.error) setError(result.error.message ?? "Unable to sign in.");
      else await onLogin();
    } catch { setError("Unable to reach the account service."); }
    finally { setBusy(false); }
  }
  return <div className="login"><div className="login-intro"><Brand /><h1>Manage meals.<br />Settle expenses.</h1><p>Track your mess's meals, deposits, and shared expenses in one place.</p><Soup size={130} strokeWidth={1} aria-hidden /></div>
    <div className="login-form"><Panel title={register ? "Activate your account" : "Sign in"}>
      {error && <p role="alert" className="notice error">{error}</p>}
      <form onSubmit={submit}>
        {register && <Field label="Name"><input name="name" required minLength={2} maxLength={90} autoComplete="name" /></Field>}
        <Field label="Email"><input name="email" required type="email" autoComplete="email" /></Field>
        <Field label="Password"><input name="password" required type="password" minLength={register ? 10 : undefined} autoComplete={register ? "new-password" : "current-password"} /></Field>
        {register && <Field label="Invitation code"><input name="code" required autoComplete="off" /></Field>}
        <button className="primary" disabled={busy}>{register ? "Create account" : "Sign in"}</button>
      </form>
      <button className="text-button" onClick={() => { setRegister(!register); setError(""); }}>{register ? "Back to sign in" : "I have an invitation code"}</button>
    </Panel></div></div>;
}
function Brand() {
  return <div className="brand"><span><Soup size={23} /></span> AmarMess</div>;
}
export default function Home() {
  const [page, setPage] = useState<Page>("Overview");
  const [state, setState] = useState<{ mess: Mess | null; member?: string; user?: { email: string } } | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    try {
      const response = await fetch("/api/ledger");
      if (response.status === 401) { setState(null); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setState(data);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not load the ledger."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const save: Save = async payload => {
    setError(""); setFeedback("");
    try {
      const response = await fetch("/api/ledger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setState(previous => ({ ...previous, ...data }));
      setFeedback(data.invitation ? "Invitation code (share privately): " + data.invitation : "Changes saved.");
      return true;
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save your changes."); return false; }
  };
  const go = (next: Page) => { setPage(next); setFeedback(""); setError(""); };
  async function logout() {
    const result = await auth.signOut();
    if (result.error) { setError(result.error.message ?? "Sign out failed."); return; }
    setState(null); go("Overview");
  }
  if (loading) return <main className="loading"><Brand /><p>Loading workspace…</p></main>;
  if (!state) return <Login onLogin={load} error={error} setError={setError} />;
  const mess = state.mess;
  const user = mess?.people.find(person => person.id === state.member);
  const period = mess ? activePeriod(mess) : undefined;
  const manager = !!user && mess?.manager === user.id;
  const can = (permission: "deposit" | "meal" | "expense") => manager || !!user?.permissions.includes(permission);
  return <div className="shell">
    <aside><Brand /><nav aria-label="Workspace">{nav.map(([item, Icon]) => <button key={item} onClick={() => go(item)} aria-current={page === item ? "page" : undefined}>
      <Icon size={19} />{item}</button>)}</nav><button className="logout" onClick={logout}><LogOut size={18} /> Sign out</button></aside>
    <main className="workspace">
      <header className="top"><div><p>{mess?.name ?? "Your workspace"}</p><h1>{mess ? page : "Set up AmarMess"}</h1></div>{user && <div className="identity"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><div>{user.name}<small>{manager ? "Manager" : "Member"}</small></div></div>}</header>
      {error && <div role="alert" className="notice error">{error}</div>}
      {feedback && <div role="status" className="notice">{feedback}</div>}
      {!mess ? <Panel title="Create your mess"><Form save={save} label="Create mess" action={form => ({ op: "setup", name: str(form, "name") })}>
        <Field label="Mess name"><input name="name" required minLength={2} maxLength={90} /></Field>
      </Form></Panel> : user && <>
        {page === "Overview" && <Overview mess={mess} period={period} user={user} save={save} go={go} />}
        {page === "Periods" && <Periods mess={mess} manager={manager} save={save} />}
        {page === "Members" && <Members mess={mess} period={period} user={user} manager={manager} save={save} />}
        {page === "Settings" && <SettingsPage mess={mess} manager={manager} save={save} />}
        {page === "Profile" && <Profile user={user} save={save} />}
        {page === "Activity" && <Activity mess={mess} user={user} />}
        {page === "Deposits" && <Panel title="Record a deposit">{period && can("deposit")
          ? <Form save={save} label="Add deposit" action={f => ({ op: "deposit", date: str(f, "date"), member: str(f, "member"), amount: number(f.get("amount")), note: str(f, "note") })}>
            <DateField min={period.start} max={dhakaNow().date} /><MemberSelect people={mess.people} /><MoneyField signed /><Notes />
          </Form> : <p>{period ? "A manager or member with deposit permission can record deposits." : "Start an accounting period to record deposits."}</p>}</Panel>}
        {page === "Meals" && (period ? <Meals mess={mess} period={period} user={user} canWrite={can("meal")} save={save} /> : <Panel title="Meals"><p>Start an accounting period to record meals.</p></Panel>)}
        {page === "Expenses" && (period && can("expense") ? <Expenses mess={mess} period={period} save={save} /> : <Panel title="Expenses"><p>{period ? "A manager or member with expense permission can record costs." : "Start an accounting period to record expenses."}</p></Panel>)}
      </>}
    </main>
  </div>;
}
function Overview({ mess, period, user, save, go }: { mess: Mess; period?: Period; user: Person; save: Save; go: (page: Page) => void }) {
  if (!period) return <Panel title="Your ledger is ready"><p>Start an accounting period to track meals and expenses.</p><button className="primary" onClick={() => go("Periods")}>View accounting periods</button></Panel>;
  const { members, totals } = summarize(period, mess.people);
  const mine = members[user.id];
  const stats = [
    { name: "Your meals", value: quantity(mine.meals), Icon: Soup },
    { name: "Your deposits", value: money(mine.deposits), Icon: Wallet },
    { name: "Your expenses", value: money(mine.expense), Icon: ShoppingBasket },
    { name: "Your balance", value: money(mine.balance), Icon: CircleDollarSign },
  ];
  return <div className="stack">
    <div className="period-banner"><div><span>ACTIVE PERIOD</span><h2>{period.name}</h2><p>Started {formatDate(period.start)}</p></div><button onClick={() => go("Periods")}>View ledger <ArrowUpRight size={16} /></button></div>
    <div className="stats">{stats.map(({ name, value, Icon }) => <div className="stat" key={name}><Icon size={19} /><p>{name}</p><strong>{value}</strong></div>)}</div>
    <div className="columns"><Panel title="Mess summary"><dl>{Object.entries({
      "Cash balance": money(totals.balance), "Opening balance": money(totals.opening), "Total deposits": money(totals.deposits),
      "Total meals": quantity(totals.meals), "Meal costs": money(totals.food), "Meal rate": totals.meals ? money(totals.rate) : "Pending meals",
      "Individual costs": money(totals.individual), "Shared costs": money(totals.shared),
    }).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></Panel>
      <div className="stack"><Panel title="Meal requests"><p>Daily cutoff at {mess.cutoff} Dhaka time.</p><button className="secondary" onClick={() => go("Meals")}>Manage meal requests</button></Panel>
        <Panel title="Your bazar dates"><BazarDates mess={mess} period={period} person={user} editable save={save} /></Panel></div>
    </div>
    <Panel title="Member balances"><Balances mess={mess} period={period} /></Panel>
  </div>;
}
function BazarDates({ mess, period, person, editable, save }: { mess: Mess; period?: Period; person: Person; editable: boolean; save: Save }) {
  const dates = mess.bazar.filter(row => row.member === person.id && row.period === period?.id).sort((a, b) => a.date.localeCompare(b.date));
  return <div>{dates.length ? <ul className="compact">{dates.map(row => <li key={row.date}>{formatDate(row.date)} {editable && <button className="text-button" onClick={() => save({ op: "bazar", member: person.id, date: row.date, remove: true })}>Remove</button>}</li>)}</ul> : <p>No bazar dates set.</p>}
    {editable && period && <Form save={save} label="Set bazar date" action={f => ({ op: "bazar", member: person.id, date: str(f, "date"), remove: false })}><DateField min={period.start} /></Form>}
  </div>;
}
function Balances({ mess, period }: { mess: Mess; period: Period }) {
  const { members } = summarize(period, mess.people);
  return <div className="table-wrap"><table><thead><tr>{["Member", "Meals", "Opening", "Deposits", "Meal costs", "Individual", "Shared", "Total costs", "Balance"].map(key => <th key={key}>{key}</th>)}</tr></thead>
    <tbody>{mess.people.map(person => { const row = members[person.id]; return <tr key={person.id}><th scope="row">{person.name}</th><td>{quantity(row.meals)}</td>
      {[row.opening, row.deposits, row.food, row.individual, row.shared, row.expense].map((item, index) => <td key={index}>{money(item)}</td>)}
      <td className={row.balance < 0 ? "negative" : "positive"}>{money(row.balance)}</td></tr>; })}</tbody></table></div>;
}
function Meals({ mess, period, user, canWrite, save }: { mess: Mess; period: Period; user: Person; canWrite: boolean; save: Save }) {
  const today = dhakaNow().date;
  const [day, setDay] = useState(today);
  const [who, setWho] = useState("all");
  const selected = mess.people.filter(person => who === "all" || person.id === who);
  const currentCounts = Object.assign({}, ...period.entries.filter(row => row.kind === "meal" && row.date === day).map(row => row.counts));
  const requests = mess.requests.filter(row => row.period === period.id);
  const own = requests.filter(row => row.member === user.id);
  const suggested = mess.people.filter(person => person.auto && person.defaults && person.autoSince && person.autoSince <= today && !requests.some(row => row.member === person.id && row.date === today))
    .map(person => ({ member: person.id, date: today, counts: person.defaults!, status: "pending", automatic: true }));
  const queue = [...requests.filter(row => row.status === "pending"), ...suggested];
  return <div className="stack">
    {canWrite && <Panel title="Record daily meals">
      <div className="meal-fields"><Field label="Date"><input type="date" value={day} min={period.start} max={today} onChange={event => setDay(event.target.value)} /></Field>
        <Field label="Members"><select value={who} onChange={event => setWho(event.target.value)}><option value="all">All members</option>{mess.people.map(person => <option value={person.id} key={person.id}>{person.name}</option>)}</select></Field></div>
      <Form key={day + who + JSON.stringify(currentCounts)} save={save} label="Save meals" action={f => ({ op: "meal", date: day, counts: Object.fromEntries(selected.map(person => [person.id, values(f, person.id)])) })}>
        {selected.map(person => <div className="subrow" key={person.id}><h3>{person.name}</h3><MealFields prefix={person.id} counts={currentCounts[person.id]} /></div>)}
      </Form>
    </Panel>}
    <div className="columns"><Panel title="Request a meal">
      <p>Today's requests close at {mess.cutoff} Dhaka time.</p>
      <Form save={save} label="Submit request" action={f => ({ op: "request", date: str(f, "date"), counts: values(f) })}>
        <DateField min={today} /><MealFields />
      </Form>
      {own.length > 0 && <ul className="compact">{own.sort((a, b) => b.date.localeCompare(a.date)).map(row => <li key={row.date}>{formatDate(row.date)} · {quantity(totalMeals(row.counts))} meals · {row.status}</li>)}</ul>}
    </Panel><Panel title="Automatic meal requests">
      <p>Use default meal quantities for today's manager review when you have no manual request.</p>
      <Form key={JSON.stringify(user.defaults) + user.auto} save={save} label="Save defaults" action={f => ({ op: "auto", enabled: f.has("enabled"), counts: values(f) })}>
        <Check name="enabled" checked={user.auto}>Enable automatic requests</Check><MealFields counts={user.defaults} />
      </Form>
    </Panel></div>
    {canWrite && <Panel title="Review meal requests">{queue.length ? <ul className="compact">{queue.map(row => <li key={row.member + row.date}>
      <strong>{nameOf(mess, row.member)}</strong> · {formatDate(row.date)} · {slots.map(slot => labels[slot] + " " + quantity(row.counts[slot])).join(" · ")}
      <div className="actions">{[true, false].map(approve => <button key={String(approve)} className="secondary" disabled={row.date > today} onClick={() => save({ op: "review", date: row.date, member: row.member, approve })}>{approve ? "Approve" : "Decline"}</button>)}</div>
    </li>)}</ul> : <p>No pending requests.</p>}</Panel>}
  </div>;
}
function Expenses({ mess, period, save }: { mess: Mess; period: Period; save: Save }) {
  const [type, setType] = useState<"food" | "shared" | "individual">("food");
  return <Panel title="Record an expense">
    <div className="tabs">{(["food", "shared", "individual"] as const).map(kind => <button type="button" key={kind} aria-pressed={type === kind} onClick={() => setType(kind)}>{kindLabels[kind]}</button>)}</div>
    <Form key={type} save={save} label="Add expense" action={f => {
      const base = { op: type, date: str(f, "date"), note: str(f, "note") };
      if (type === "food") return { ...base, cost: number(f.get("amount")), shoppers: f.getAll("people"), credit: f.has("credit") };
      if (type === "shared") return { ...base, cost: number(f.get("amount")), members: f.getAll("people") };
      return { ...base, amounts: Object.fromEntries(mess.people.map(person => [person.id, number(f.get(person.id))]).filter(([, value]) => value !== 0)) };
    }}>
      <DateField min={period.start} max={dhakaNow().date} />
      {type !== "individual" && <MoneyField />}
      <Notes label={type === "food" ? "Bazar list" : "Expense details"} />
      {type === "individual" ? <div className="meal-fields">{mess.people.map(person => <MoneyField key={person.id} name={person.id} label={person.name + " (BDT)"} required={false} />)}</div>
        : <fieldset><legend>{type === "food" ? "Shoppers" : "Split equally among"}</legend>{mess.people.map(person => <Check key={person.id} name="people" value={person.id} checked={type === "shared"}>{person.name}</Check>)}</fieldset>}
      {type === "food" && <Check name="credit">Credit the shoppers' deposits for this expense, split equally</Check>}
    </Form>
  </Panel>;
}
function entryDetails(mess: Mess, row: Entry, pdf = false) {
  const currency = (amount: number) => pdf ? "BDT " + (amount / 100).toFixed(2) : money(amount);
  const details = [];
  if (row.note) details.push(row.note);
  if (row.cost !== undefined) details.push(currency(row.cost));
  if (row.shoppers?.length) details.push("Shoppers: " + row.shoppers.map(id => nameOf(mess, id)).join(", "));
  for (const [id, amount] of Object.entries(row.amounts ?? {})) details.push(nameOf(mess, id) + " · " + currency(amount));
  for (const [id, amount] of Object.entries(row.credits ?? {})) details.push(nameOf(mess, id) + " credited " + currency(amount));
  for (const [id, counts] of Object.entries(row.counts ?? {})) details.push(nameOf(mess, id) + " · " + slots.map(slot => labels[slot] + " " + quantity(counts[slot])).join(", ") + " · Total " + quantity(totalMeals(counts)));
  return details;
}
function Periods({ mess, manager, save }: { mess: Mess; manager: boolean; save: Save }) {
  const active = activePeriod(mess);
  const [selection, setSelection] = useState("");
  const [kind, setKind] = useState<Entry["kind"]>("meal");
  const [limit, setLimit] = useState(20);
  const period = mess.periods.find(item => item.id === selection) ?? active;
  const records = period?.entries.filter(row => row.kind === kind).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)) ?? [];
  async function download() {
    if (!period) return;
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    let y = 18;
    function write(text: string, size = 10) {
      pdf.setFontSize(size);
      for (const line of pdf.splitTextToSize(text, 174) as string[]) {
        if (y > 277) { pdf.addPage(); y = 18; }
        pdf.text(line, 18, y); y += size * 0.47;
      }
    }
    write(mess.name + " / " + period.name, 16);
    write(period.start + " to " + (period.end ?? "present"));
    const { members, totals } = summarize(period, mess.people);
    write("Meals " + quantity(totals.meals) + " | Meal costs BDT " + (totals.food / 100).toFixed(2) + " | Cash balance BDT " + (totals.balance / 100).toFixed(2));
    for (const person of mess.people) write(person.name + " | Balance BDT " + (members[person.id].balance / 100).toFixed(2));
    for (const row of [...period.entries].sort((a, b) => b.date.localeCompare(a.date))) {
      y += 3;
      write(row.date + " / " + kindLabels[row.kind], 12);
      for (const detail of entryDetails(mess, row, true)) write(detail.replaceAll("·", "|"));
    }
    pdf.save("AmarMess-" + period.start + ".pdf");
  }
  return <div className="stack">
    <div className="columns"><Panel title="Accounting periods">
      {mess.periods.length ? <ul className="compact">{[...mess.periods].reverse().map(item => <li key={item.id}><button className="text-button" onClick={() => { setSelection(item.id); setLimit(20); }}>{item.name}</button> <span>{item.end ? "Closed" : "Active"} · {formatDate(item.start)}{item.end ? " – " + formatDate(item.end) : ""}</span></li>)}</ul> : <p>No periods yet.</p>}
    </Panel>{manager && <Panel title="Start a new period">
      {active && <p>This closes the current period and locks its ledger.</p>}
      <Form save={async payload => { if (active && !window.confirm("Close the current accounting period?")) return false; if (!await save(payload)) return false; setSelection(""); return true; }} label="Start period" action={f => ({ op: "period", name: str(f, "name"), start: str(f, "date"), carry: f.has("carry") })}>
        <Field label="Period name"><input name="name" placeholder="November 2026" required minLength={2} maxLength={90} /></Field>
        <DateField max={dhakaNow().date} />{active && <Check name="carry">Carry forward member balances</Check>}
      </Form></Panel>}</div>
    {period && <Panel title={period.name}>
      <div className="actions"><button className="secondary" onClick={download}>Download PDF</button></div>
      {manager && period.id === active?.id && <details><summary>Rename active period</summary><Form save={save} label="Rename" action={f => ({ op: "rename", name: str(f, "name") })}>
        <Field label="Period name"><input name="name" key={period.name} defaultValue={period.name} minLength={2} maxLength={90} required /></Field></Form></details>}
      <Balances mess={mess} period={period} />
      <div className="tabs">{(Object.keys(kindLabels) as Entry["kind"][]).map(key => <button key={key} aria-pressed={kind === key} onClick={() => { setKind(key); setLimit(20); }}>{kindLabels[key]}</button>)}</div>
      {records.length ? <ul className="compact">{records.slice(0, limit).map(row => <li key={row.id}>
        <strong>{formatDate(row.date)}</strong>{entryDetails(mess, row).map((detail, i) => <div key={i}>{detail}</div>)}
        {manager && period.id === active?.id && <button className="text-button" onClick={() => { if (window.confirm("Remove this ledger entry?")) void save({ op: "removeEntry", entry: row.id }); }}>Remove entry</button>}
      </li>)}</ul> : <p>No {kindLabels[kind].toLowerCase()} recorded.</p>}
      {records.length > limit && <button className="secondary" onClick={() => setLimit(limit + 20)}>Load more</button>}
    </Panel>}
  </div>;
}
function Members({ mess, period, user, manager, save }: { mess: Mess; period?: Period; user: Person; manager: boolean; save: Save }) {
  return <div className="stack">
    {manager && <div className="columns"><Panel title="Invite a member">
      <Form save={save} label="Generate invitation" action={f => ({ op: "member", name: str(f, "name"), email: str(f, "email"), phone: str(f, "phone") })}>
        <Field label="Name"><input name="name" required minLength={2} maxLength={90} /></Field>
        <Field label="Email"><input name="email" type="email" required /></Field>
        <Field label="Phone (optional)"><input name="phone" type="tel" maxLength={32} /></Field>
      </Form></Panel>
      <Panel title="Transfer manager access"><p>The selected member will manage this workspace.</p>
      <Form save={async payload => window.confirm("Transfer manager access?") && await save(payload)} label="Transfer access" action={f => ({ op: "manager", member: str(f, "member") })}>
        <MemberSelect people={mess.people.filter(person => person.id !== user.id)} /></Form></Panel></div>}
    <div className="member-grid">{mess.people.map(person => <Panel title={person.name} key={person.id}>
      <p className="member-role">{mess.manager === person.id ? "Manager" : "Member"}</p><p>{person.email}</p>{person.phone && <p>{person.phone}</p>}
      {mess.manager !== person.id && <><h3>Permissions</h3>{manager ? <Form key={person.permissions.join(",")} save={save} label="Save permissions" action={f => ({ op: "permissions", member: person.id, permissions: f.getAll("permission") })}>
        {(["deposit", "meal", "expense"] as const).map(permission => <Check name="permission" key={permission} value={permission} checked={person.permissions.includes(permission)}>Record {permission}s</Check>)}
      </Form> : <p>{person.permissions.join(", ") || "Standard member access"}</p>}</>}
      <h3>Bazar dates</h3><BazarDates mess={mess} period={period} person={person} editable={manager || user.id === person.id} save={save} />
    </Panel>)}</div>
  </div>;
}
function SettingsPage({ mess, manager, save }: { mess: Mess; manager: boolean; save: Save }) {
  if (!manager) return <Panel title="Mess settings"><p>Meal request cutoff is {mess.cutoff} Dhaka time.</p></Panel>;
  return <div className="columns">
    <Panel title="Mess preferences"><Form save={save} label="Save settings" action={f => ({ op: "settings", name: str(f, "name"), cutoff: str(f, "cutoff") })}>
      <Field label="Mess name"><input name="name" required minLength={2} maxLength={90} defaultValue={mess.name} /></Field>
      <Field label="Meal request cutoff (Dhaka time)"><input name="cutoff" type="time" required defaultValue={mess.cutoff} /></Field>
    </Form></Panel>
    <Panel title="Delete mess"><p>Permanently deletes the workspace and every accounting period.</p>
      <Form danger save={async payload => window.confirm("Permanently delete this mess and its ledger?") && await save(payload)} label="Delete mess" action={f => ({ op: "delete", name: str(f, "name") })}>
        <Field label="Type the mess name to confirm"><input name="name" required /></Field>
      </Form>
    </Panel>
  </div>;
}
function Profile({ user, save }: { user: Person; save: Save }) {
  const [status, setStatus] = useState("");
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    try {
      const result = await auth.changePassword({ currentPassword: str(form, "current"), newPassword: str(form, "next"), revokeOtherSessions: true });
      setStatus(result.error ? result.error.message ?? "Password change failed." : "Password updated.");
      if (!result.error) element.reset();
    } catch { setStatus("Unable to reach the account service."); }
  }
  return <div className="columns"><Panel title="Account information"><p>{user.email}</p><Form save={save} label="Save profile" action={f => ({ op: "profile", name: str(f, "name"), phone: str(f, "phone") })}>
    <Field label="Name"><input name="name" defaultValue={user.name} required minLength={2} maxLength={90} /></Field>
    <Field label="Phone"><input name="phone" defaultValue={user.phone} type="tel" maxLength={32} /></Field>
  </Form></Panel><Panel title="Change password"><form onSubmit={changePassword}>
    <Field label="Current password"><input name="current" type="password" autoComplete="current-password" required /></Field>
    <Field label="New password"><input name="next" type="password" autoComplete="new-password" minLength={10} required /></Field>
    <button className="primary">Update password</button>{status && <p role="status">{status}</p>}
  </form></Panel></div>;
}
function Activity({ mess, user }: { mess: Mess; user: Person }) {
  const updates = mess.periods.flatMap(period => period.entries).filter(row => row.kind === "food" || user.id in (row.amounts ?? {}) || user.id in (row.counts ?? {}))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <Panel title="Recent activity">{updates.length ? <ul className="compact">{updates.slice(0, 50).map(row => <li key={row.id}>
    <strong>{kindLabels[row.kind]}</strong> · {formatDate(row.date)} <small>Recorded by {nameOf(mess, row.actor)}</small>
    {entryDetails(mess, row.kind === "meal" ? { ...row, counts: { [user.id]: row.counts![user.id] } } : row).map((detail, i) => <div key={i}>{detail}</div>)}
  </li>)}</ul> : <p>Meal, deposit and expense updates will appear here.</p>}</Panel>;
}
