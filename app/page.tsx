"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createAuthClient } from "better-auth/react";
import { ArrowUpRight, Bell, CalendarDays, CircleDollarSign, LayoutDashboard, LogOut, Menu, Settings, ShoppingBasket, Soup, UserRound, Users, Wallet, X } from "lucide-react";
import { activePeriod, dhakaNow, kindLabels, money, quantity, slots, split, summarize, totalMeals, zero, type Counts, type Entry, type Mess, type Period, type Person } from "../lib/domain";

const auth = createAuthClient();
const nav = [
  ["Home", LayoutDashboard], ["Add Deposit", Wallet], ["Add Meal", Soup], ["Add Cost", ShoppingBasket],
  ["Active Month Details", CalendarDays], ["All Month Details", CalendarDays], ["Start New Month", CalendarDays],
  ["Mess Members", Users], ["Change Manager", UserRound], ["Mess Settings", Settings], ["Delete Mess", Settings],
] as const;
const accountNav = [["Notifications", Bell], ["Profile", UserRound]] as const;
type Page = typeof nav[number][0] | typeof accountNav[number][0];
const pageHash = (page: Page) => "#" + page.toLowerCase().replaceAll(" ", "-");
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
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
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
  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = str(form, "password");
    if (password !== str(form, "confirm")) { setError("Passwords do not match."); return; }
    setBusy(true);
    setError("");
    try {
      const result = await auth.resetPassword({ token: str(form, "code").trim(), newPassword: password });
      if (result.error) setError("The reset could not be completed. Check your code or ask the owner for a new one.");
      else { setResetting(false); setResetDone(true); }
    } catch { setError("Unable to reach the account service."); }
    finally { setBusy(false); }
  }
  return <div className="login"><div className="login-intro"><Brand /><h1>Manage meals.<br />Settle expenses.</h1><p>Track your mess's meals, deposits, and shared expenses in one place.</p><Soup size={130} strokeWidth={1} aria-hidden /></div>
    <div className="login-form"><Panel title={resetting ? "Reset password" : register ? "Activate your account" : "Sign in"}>
      {error && <p role="alert" className="notice error">{error}</p>}
      {resetDone && !resetting && <p role="status" className="notice">Password reset. Sign in with your new password.</p>}
      {resetting ? <form onSubmit={resetPassword}>
        <Field label="Owner reset code"><input name="code" required autoComplete="off" /></Field>
        <Field label="New password"><input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" /></Field>
        <Field label="Confirm password"><input name="confirm" type="password" required minLength={10} maxLength={128} autoComplete="new-password" /></Field>
        <button className="primary" disabled={busy}>Reset password</button>
      </form> : <form onSubmit={submit}>
        {register && <Field label="Name"><input name="name" required minLength={2} maxLength={90} autoComplete="name" /></Field>}
        <Field label="Email"><input name="email" required type="email" autoComplete="email" /></Field>
        <Field label="Password"><input name="password" required type="password" minLength={register ? 10 : undefined} autoComplete={register ? "new-password" : "current-password"} /></Field>
        {register && <Field label="Invitation code"><input name="code" required autoComplete="off" /></Field>}
        <button className="primary" disabled={busy}>{register ? "Create account" : "Sign in"}</button>
      </form>}
      {resetting ? <button className="text-button" onClick={() => { setResetting(false); setError(""); }}>Back to sign in</button>
        : <div className="actions"><button className="text-button" onClick={() => { setRegister(!register); setError(""); }}>{register ? "Back to sign in" : "I have an invitation code"}</button>
          {!register && <button className="text-button" onClick={() => { setResetting(true); setError(""); setResetDone(false); }}>Use an owner reset code</button>}</div>}
    </Panel></div></div>;
}
function Brand() {
  return <div className="brand"><span><Soup size={23} /></span> AmarMess</div>;
}
export default function Home() {
  const [page, setPage] = useState<Page>("Home");
  const [state, setState] = useState<{ mess: Mess | null; member?: string; owner?: boolean; user?: { email: string } } | null>(null);
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
      if (data.resetCode) {
        setFeedback("Owner reset code (valid for 15 minutes): " + data.resetCode);
        return true;
      }
      setState(previous => ({ ...previous, ...data }));
      setFeedback(data.invitation ? "Invitation code (share privately): " + data.invitation : "Changes saved.");
      return true;
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save your changes."); return false; }
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 940px)");
    const closeOnDesktop = () => { if (!narrow.matches) drawer.current?.close(); };
    narrow.addEventListener("change", closeOnDesktop);
    return () => narrow.removeEventListener("change", closeOnDesktop);
  }, []);
  useEffect(() => {
    function syncPage() {
      const match = [...nav, ...accountNav].find(([name]) => pageHash(name) === window.location.hash);
      setPage(match?.[0] ?? "Home");
    }
    syncPage();
    window.addEventListener("hashchange", syncPage);
    return () => window.removeEventListener("hashchange", syncPage);
  }, []);
  const go = (next: Page) => {
    if (window.location.hash !== pageHash(next)) window.location.hash = pageHash(next);
    drawer.current?.close();
    setPage(next); setFeedback(""); setError("");
  };
  async function logout() {
    const result = await auth.signOut();
    if (result.error) { setError(result.error.message ?? "Sign out failed."); return; }
    setState(null); go("Home");
  }
  if (loading) return <main className="loading"><Brand /><p>Loading workspace…</p></main>;
  if (!state) return <Login onLogin={load} error={error} setError={setError} />;
  const mess = state.mess;
  const user = mess?.people.find(person => person.id === state.member);
  const period = mess ? activePeriod(mess) : undefined;
  const manager = !!user && mess?.manager === user.id;
  const can = (permission: "deposit" | "meal" | "expense") => manager || !!user?.permissions.includes(permission);
  const shortcuts = [nav[0], nav[2], nav[4], ...accountNav];
  const navigation = <><nav aria-label="Workspace">{nav.map(([item, Icon]) => <button key={item} onClick={() => go(item)} aria-current={page === item ? "page" : undefined}>
      <Icon size={19} />{item}</button>)}</nav><nav className="account-nav" aria-label="Account">{accountNav.map(([item, Icon]) => <button key={item} onClick={() => go(item)} aria-current={page === item ? "page" : undefined}><Icon size={19} />{item}</button>)}</nav><button className="logout" onClick={logout}><LogOut size={18} /> Sign out</button></>;
  return <div className="shell">
    <aside><div className="sidebar-header">
      <button type="button" className="mobile-menu secondary" aria-label="Open menu" aria-haspopup="dialog" aria-expanded={menuOpen} aria-controls="workspace-drawer" onClick={() => {
        drawer.current?.showModal();
        setMenuOpen(true);
      }}><Menu size={23} aria-hidden /></button>
      <Brand />
    </div><div className="sidebar-links">{navigation}</div></aside>
    <dialog ref={drawer} id="workspace-drawer" className="workspace-drawer" aria-labelledby="drawer-title"
      onClose={() => setMenuOpen(false)} onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <div className="drawer-content">
        <header><h2 id="drawer-title">Menu</h2><button type="button" className="secondary" aria-label="Close menu" autoFocus onClick={() => drawer.current?.close()}><X size={20} aria-hidden /></button></header>
        <div className="sidebar-links">{navigation}</div>
      </div>
    </dialog>
    <main className="workspace">
      <header className="top"><div><p>{mess?.name ?? "Your workspace"}</p><h1>{mess ? page : "Set up AmarMess"}</h1></div>{user && <div className="identity"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><div>{user.name}<small>{manager ? "Manager" : "Member"}</small></div></div>}</header>
      {error && <div role="alert" className="notice error">{error}</div>}
      {feedback && <div role="status" className="notice">{feedback}</div>}
      {!mess ? <Panel title="Create your mess"><Form save={save} label="Create mess" action={form => ({ op: "setup", name: str(form, "name") })}>
        <Field label="Mess name"><input name="name" required minLength={2} maxLength={90} /></Field>
      </Form></Panel> : user && <>
        {page === "Home" && <Overview mess={mess} period={period} user={user} save={save} go={go} />}
        {(page === "Active Month Details" || page === "All Month Details") && <Periods key={page} mess={mess} manager={manager} archive={page === "All Month Details"} save={save} />}
        {page === "Start New Month" && <StartMonth period={period} manager={manager} save={save} onStarted={() => go("Active Month Details")} />}
        {page === "Change Manager" && <ChangeManager mess={mess} user={user} manager={manager} save={save} />}
        {page === "Delete Mess" && <DeleteMess mess={mess} manager={manager} save={save} />}
        {page === "Mess Members" && <Members mess={mess} period={period} user={user} manager={manager} owner={!!state.owner} save={save} />}
        {page === "Mess Settings" && <SettingsPage mess={mess} manager={manager} save={save} />}
        {page === "Profile" && <Profile user={user} save={save} />}
        {page === "Notifications" && <Activity mess={mess} user={user} />}
        {page === "Add Deposit" && <Panel title="Record a deposit">{period && can("deposit")
          ? <Form save={save} label="Add deposit" action={f => ({ op: "deposit", date: str(f, "date"), member: str(f, "member"), amount: number(f.get("amount")), note: str(f, "note") })}>
            <DateField min={period.start} max={dhakaNow().date} /><MemberSelect people={mess.people} /><MoneyField signed /><Notes />
          </Form> : <p>{period ? "A manager or member with deposit permission can record deposits." : "Start an accounting period to record deposits."}</p>}</Panel>}
        {page === "Add Meal" && (period && can("meal") ? <Meals mess={mess} period={period} save={save} /> : <Panel title="Meals"><p>{period ? "Meal entry is available to the manager and members with meal permission." : "Start an accounting period to record meals."}</p></Panel>)}
        {page === "Add Cost" && (period && can("expense") ? <Expenses mess={mess} period={period} save={save} /> : <Panel title="Expenses"><p>{period ? "A manager or member with expense permission can record costs." : "Start an accounting period to record expenses."}</p></Panel>)}
      </>}
    </main>
    {mess && user && <nav className="mobile-shortcuts" aria-label="Quick navigation">
      {shortcuts.map(([item, Icon]) => <button key={item} onClick={() => go(item)} aria-current={page === item ? "page" : undefined}>
        <Icon size={20} aria-hidden /><span>{item === "Active Month Details" ? "Ledger" : item === "Add Meal" ? "Meals" : item}</span>
      </button>)}
    </nav>}
  </div>;
}
function Overview({ mess, period, user, save, go }: { mess: Mess; period?: Period; user: Person; save: Save; go: (page: Page) => void }) {
  if (!period) return <Panel title="Your ledger is ready"><p>Start an accounting period to track meals and expenses.</p><button className="primary" onClick={() => go("All Month Details")}>View accounting periods</button></Panel>;
  const { members, totals } = summarize(period, mess.people);
  const mine = members[user.id];
  const stats = [
    { name: "Your meals", value: quantity(mine.meals), Icon: Soup },
    { name: "Your deposits", value: money(mine.deposits), Icon: Wallet },
    { name: "Your expenses", value: money(mine.expense), Icon: ShoppingBasket },
    { name: "Your balance", value: money(mine.balance), Icon: CircleDollarSign },
  ];
  return <div className="stack">
    <div className="dashboard-grid">
      <section className="panel mess-summary">
        <header className="summary-header"><div><h2>{period.name}</h2><p>{mess.name} · Started {formatDate(period.start)}</p></div><span>Active</span></header>
        <div className="summary-body"><dl>{[
          { label: "Mess balance", value: money(totals.balance), Icon: Wallet },
          { label: "Opening balance", value: money(totals.opening), Icon: Wallet, hidden: !totals.opening },
          { label: "Total deposits", value: money(totals.deposits), Icon: CircleDollarSign },
          { label: "Total meals", value: quantity(totals.meals), Icon: Soup },
          { label: "Meal costs", value: money(totals.food), Icon: ShoppingBasket },
          { label: "Meal rate", value: totals.meals ? money(totals.rate) : "Pending meals", Icon: CircleDollarSign },
          { label: "Individual costs", value: money(totals.individual), Icon: UserRound },
          { label: "Shared costs", value: money(totals.shared), Icon: Users },
        ].filter(row => !row.hidden).map(({ label, value, Icon }) => <div key={label}><dt><Icon size={16} aria-hidden />{label}</dt><dd>{value}</dd></div>)}</dl>
        <button className="secondary summary-link" onClick={() => go("Active Month Details")}>View ledger <ArrowUpRight size={16} aria-hidden /></button></div>
      </section>
      <div className="stack">
        <section className="personal-summary"><h2>My summary</h2>
          <div className="stats">{stats.map(({ name, value, Icon }) => <div className="stat" key={name}><Icon size={19} aria-hidden /><strong>{value}</strong><p>{name}</p></div>)}</div>
        </section>
        <Panel title="My bazar dates"><BazarDates mess={mess} period={period} person={user} editable save={save} /></Panel>
      </div>
    </div>
    <section><h2>All members · {mess.people.length}</h2><div className="member-grid">{mess.people.map(person => {
      const row = members[person.id];
      return <Panel title={person.name} key={person.id}>
        <p className={row.balance < 0 ? "negative" : "positive"}>{row.balance < 0 ? "Owes" : row.balance > 0 ? "Receives" : "Settled"} · {money(Math.abs(row.balance))}</p>
        <dl>{Object.entries({ Meals: quantity(row.meals), Deposits: money(row.deposits), "Opening balance": money(row.opening), "Meal cost": money(row.food), "Individual cost": money(row.individual), "Shared cost": money(row.shared), "Total cost": money(row.expense) })
          .map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </Panel>;
    })}</div></section>
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
function Meals({ mess, period, save }: { mess: Mess; period: Period; save: Save }) {
  const today = dhakaNow().date;
  const [day, setDay] = useState(today);
  const [who, setWho] = useState("all");
  const [settingsError, setSettingsError] = useState(false);
  const settings = useRef<HTMLDialogElement>(null);
  const selected = mess.people.filter(person => who === "all" || person.id === who);
  const currentCounts: Record<string, Counts> = Object.assign({}, ...period.entries.filter(row => row.kind === "meal" && row.date === day).map(row => row.counts));
  const initialCounts = Object.fromEntries(selected.map(person => [person.id, currentCounts[person.id] ?? mess.mealDefaults ?? zero]));

  return <div className="meal-entry"><Panel title="Record daily meals">
    <div className="actions"><button type="button" className="secondary" aria-haspopup="dialog" onClick={() => {
      setSettingsError(false);
      settings.current?.querySelector("form")?.reset();
      settings.current?.showModal();
    }}>Default meal settings</button></div>
    <dialog ref={settings} className="meal-default-dialog" aria-labelledby="meal-default-title">
      <h2 id="meal-default-title">Default meal settings</h2>
      <p>These amounts prefill unsaved meals for every member. You can adjust them before saving the day.</p>
      {settingsError && <p className="notice error" role="alert">Defaults could not be saved. Close this window to see the error.</p>}
      <Form label="Save defaults" action={f => ({ op: "mealDefaults", counts: values(f) })} save={async payload => {
        setSettingsError(false);
        const saved = await save(payload);
        if (saved) settings.current?.close();
        else setSettingsError(true);
        return saved;
      }}>
        <MealFields counts={mess.mealDefaults} />
        <button type="button" className="secondary" onClick={() => settings.current?.close()}>Cancel</button>
      </Form>
    </dialog>
    <div className="meal-fields"><Field label="Date"><input type="date" value={day} min={period.start} max={today} onChange={event => setDay(event.target.value)} /></Field>
      <Field label="Members"><select value={who} onChange={event => setWho(event.target.value)}><option value="all">All members</option>{mess.people.map(person => <option value={person.id} key={person.id}>{person.name}</option>)}</select></Field></div>
    <Form key={day + who + JSON.stringify(initialCounts)} save={save} label="Add meal" action={f => ({ op: "meal", date: day, counts: Object.fromEntries(selected.map(person => [person.id, values(f, person.id)])) })}>
      {selected.map(person => <div className="subrow" key={person.id}><h3>{person.name}</h3><MealFields prefix={person.id} counts={initialCounts[person.id]} /></div>)}
    </Form>
  </Panel></div>;
}
function Expenses({ mess, period, save }: { mess: Mess; period: Period; save: Save }) {
  const [type, setType] = useState<"food" | "shared" | "individual">("food");
  return <div className="expense-entry"><Panel title="Record an expense">
    <div className="tabs"><button aria-pressed={type === "food"} onClick={() => setType("food")}>Meal Cost</button>
      <button aria-pressed={type !== "food"} onClick={() => setType("shared")}>Other Cost</button></div>
    {type !== "food" && <Field label="Cost type"><select value={type} onChange={event => setType(event.target.value === "individual" ? "individual" : "shared")}>
      <option value="shared">Shared</option><option value="individual">Individual</option></select></Field>}
    <Form key={type} save={save} label="Add cost" action={f => {
      const base = { op: type, date: str(f, "date"), note: str(f, "note") };
      if (type === "food") return { ...base, cost: number(f.get("amount")), shoppers: f.getAll("people"), credit: f.has("credit") };
      if (type === "shared") return { ...base, cost: number(f.get("amount")), members: f.getAll("people") };
      return { ...base, amounts: Object.fromEntries(f.getAll("people").map(id => [String(id), number(f.get(String(id)))])) };
    }}>
      <DateField min={period.start} max={dhakaNow().date} />
      {type === "shared" ? <SharedExpenseFields people={mess.people} /> : <>
        {type === "food" && <MoneyField />}
        <Notes label={type === "food" ? "Bazar list" : "Expense details"} />
        {type === "individual" ? <IndividualExpenseFields people={mess.people} /> : <>
          <fieldset><legend>Shoppers</legend>{mess.people.map(person => <Check key={person.id} name="people" value={person.id}>{person.name}</Check>)}</fieldset>
          <Check name="credit">Credit the shoppers' deposits for this expense, split equally</Check>
        </>}
      </>}
    </Form>
  </Panel></div>;
}
function IndividualExpenseFields({ people }: { people: Person[] }) {
  const [excluded, setExcluded] = useState<string[]>([]);
  return <fieldset className="individual-cost-members">
    <legend>Individual charges</legend>
    <p>Uncheck anyone you want to exclude, then enter the amounts.</p>
    {people.map(person => {
      const checked = !excluded.includes(person.id);
      return <div className="individual-cost-row" key={person.id}>
        <label><input type="checkbox" name="people" value={person.id} checked={checked}
          onChange={event => {
            const enabled = event.target.checked;
            setExcluded(ids => enabled ? ids.filter(id => id !== person.id) : [...ids, person.id]);
          }} /> <span>{person.name}</span></label>
        <input aria-label={`${person.name} amount (BDT)`} name={person.id}
          type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01"
          placeholder="0.00" disabled={!checked} required={checked} />
      </div>;
    })}
  </fieldset>;
}
function SharedExpenseFields({ people }: { people: Person[] }) {
  const [amount, setAmount] = useState("");
  const [excluded, setExcluded] = useState<string[]>([]);
  const selected = people.filter(person => !excluded.includes(person.id));
  const cents = number(amount);
  const validAmount = Number.isFinite(cents) && cents >= 1 && cents <= 100000000;
  const shares = validAmount ? split(cents, Object.fromEntries(selected.map(person => [person.id, 1]))) : {};
  const shareValues = [...new Set(Object.values(shares))].sort((a, b) => a - b);
  const shareText = shareValues.map(money).join("–");

  return <>
    <Field label="Amount (BDT)">
      <input name="amount" type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01" required
        value={amount} onChange={event => setAmount(event.target.value)} />
    </Field>
    <Notes label="Expense details" />
    <fieldset className="shared-split">
      <legend>Split equally among</legend>
      <div className="shared-split-summary" role="status">
        {selected.length === 0 ? <p>Select at least one member.</p>
          : !validAmount ? <p>Enter an amount to see each member's share.</p>
          : <><strong>{shareText} per member</strong>
            <p>{money(cents)} total · {selected.length} {selected.length === 1 ? "member" : "members"} selected</p></>}
      </div>
      {people.map(person => <label className="shared-split-row" key={person.id}>
        <input type="checkbox" name="people" value={person.id} checked={!excluded.includes(person.id)}
          onChange={event => {
            const checked = event.target.checked;
            setExcluded(current => checked ? current.filter(id => id !== person.id) : [...current, person.id]);
          }} />
        <span>{person.name}</span>
        <span className="shared-split-amount">{person.id in shares ? <><small>Share</small><strong>{money(shares[person.id])}</strong></> : "—"}</span>
      </label>)}
    </fieldset>
  </>;
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
function Periods({ mess, manager, archive, save }: { mess: Mess; manager: boolean; archive: boolean; save: Save }) {
  const active = activePeriod(mess);
  const [selection, setSelection] = useState("");
  const [kind, setKind] = useState<Entry["kind"]>("meal");
  const [limit, setLimit] = useState(20);
  const period = archive ? mess.periods.find(item => item.id === selection) : active;
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
    {archive && <Panel title="Month list">
      {mess.periods.length ? <ul className="compact">{[...mess.periods].reverse().map(item => <li className="month-row" key={item.id}>
        <div><strong>{item.name}</strong><p>{formatDate(item.start)} {item.end ? "– " + formatDate(item.end) : "· Active"}</p></div>
        <button className="secondary" aria-pressed={selection === item.id} onClick={() => { setSelection(item.id); setLimit(20); setKind("meal"); }}>View details</button>
      </li>)}</ul> : <p>No accounting months yet.</p>}
    </Panel>}
    {!archive && !period && <Panel title="Active month details"><p>Start an accounting month to view its ledger.</p></Panel>}
    {period && <Panel title={period.name}>
      <div className="actions"><button className="secondary" onClick={download}>Download PDF</button></div>
      {manager && period.id === active?.id && <details><summary>Rename active period</summary><Form save={save} label="Rename" action={f => ({ op: "rename", name: str(f, "name") })}>
        <Field label="Period name"><input name="name" key={period.name} defaultValue={period.name} minLength={2} maxLength={90} required /></Field></Form></details>}
      <Balances mess={mess} period={period} />
      <div className="tabs">{(Object.keys(kindLabels) as Entry["kind"][]).map(key => <button key={key} aria-pressed={kind === key} onClick={() => { setKind(key); setLimit(20); }}>{kindLabels[key]}</button>)}</div>
      {records.length ? (kind === "meal"
        ? <DailyMealTable mess={mess} records={records} limit={limit} />
        : <ul className="compact report-list">{records.slice(0, limit).map(row => <li key={row.id}>
          <strong>{formatDate(row.date)}</strong>{entryDetails(mess, row).map((detail, i) => <div key={i}>{detail}</div>)}
          {manager && period.id === active?.id && <button className="text-button" onClick={() => { if (window.confirm("Remove this ledger entry?")) void save({ op: "removeEntry", entry: row.id }); }}>Remove entry</button>}
        </li>)}</ul>)
        : <p>No {kindLabels[kind].toLowerCase()} recorded.</p>}
      {kind === "meal" && manager && period.id === active?.id && records.length > 0 && <details><summary>Remove a meal entry</summary>
        <ul className="compact">{records.map(row => <li key={row.id}><span>{formatDate(row.date)} · {Object.keys(row.counts ?? {}).length} members </span>
          <button className="text-button" onClick={() => { if (window.confirm("Remove this meal entry?")) void save({ op: "removeEntry", entry: row.id }); }}>Remove entry</button></li>)}</ul>
      </details>}
      {(kind === "meal" ? new Set(records.map(row => row.date)).size : records.length) > limit && <button className="secondary" onClick={() => setLimit(limit + 20)}>Load more</button>}
    </Panel>}
  </div>;
}
function DailyMealTable({ mess, records, limit }: { mess: Mess; records: Entry[]; limit: number }) {
  const byDate = new Map<string, Record<string, Counts>>();
  for (const row of records) byDate.set(row.date, { ...byDate.get(row.date), ...row.counts });
  function cells(counts: Counts) {
    return <>{slots.map(slot => <div key={slot}>{labels[slot]} {quantity(counts[slot])}</div>)}<strong>Total {quantity(totalMeals(counts))}</strong></>;
  }
  return <div className="table-wrap"><table className="daily-meals"><thead><tr>
    <th scope="col">Date</th><th scope="col">Total meals</th>{mess.people.map(person => <th scope="col" key={person.id}>{person.name}</th>)}
  </tr></thead><tbody>{[...byDate].slice(0, limit).map(([day, rows]) => {
    const totals = { ...zero };
    for (const counts of Object.values(rows)) for (const slot of slots) totals[slot] += counts[slot];
    return <tr key={day}><th scope="row">{formatDate(day)}</th><td>{cells(totals)}</td>
      {mess.people.map(person => <td key={person.id}>{cells(rows[person.id] ?? zero)}</td>)}</tr>;
  })}</tbody></table></div>;
}
function StartMonth({ period, manager, save, onStarted }: { period?: Period; manager: boolean; save: Save; onStarted: () => void }) {
  return <Panel title="Start new month">{manager ? <>
    {period && <p>This closes the active month. Check its totals before carrying balances forward.</p>}
    <Form save={async payload => {
      if (period && !window.confirm("Close the current accounting month?")) return false;
      const saved = await save(payload);
      if (saved) onStarted();
      return saved;
    }} label="Start new month" action={f => ({ op: "period", name: str(f, "name"), start: str(f, "date"), carry: f.has("carry") })}>
      <Field label="Month name"><input name="name" required minLength={2} maxLength={90} /></Field>
      <DateField max={dhakaNow().date} />{period && <Check name="carry">Carry forward member balances</Check>}
    </Form></> : <p>Only the manager can start a new accounting month.</p>}</Panel>;
}
function ChangeManager({ mess, user, manager, save }: { mess: Mess; user: Person; manager: boolean; save: Save }) {
  const candidates = mess.people.filter(person => person.id !== user.id);
  return <Panel title="Change mess manager">
    {!manager ? <p>Only the current manager can transfer access.</p> : candidates.length ? <Form
      save={async payload => window.confirm("Transfer manager access?") && await save(payload)}
      label="Transfer access" action={f => ({ op: "manager", member: str(f, "member") })}>
      <MemberSelect people={candidates} />
    </Form> : <p>Invite a member before transferring access.</p>}
  </Panel>;
}
function Members({ mess, period, user, manager, owner, save }: { mess: Mess; period?: Period; user: Person; manager: boolean; owner: boolean; save: Save }) {
  const [adding, setAdding] = useState(false);
  return <div className="stack">
    {manager && <div className="tabs"><button aria-pressed={!adding} onClick={() => setAdding(false)}>All Members List</button>
      <button aria-pressed={adding} onClick={() => setAdding(true)}>Add New Member</button></div>}
    {manager && adding ? <Panel title="Invite a member">
      <Form save={save} label="Generate invitation" action={f => ({ op: "member", name: str(f, "name"), email: str(f, "email"), phone: str(f, "phone") })}>
        <Field label="Name"><input name="name" required minLength={2} maxLength={90} /></Field>
        <Field label="Email"><input name="email" type="email" required /></Field>
        <Field label="Phone (optional)"><input name="phone" type="tel" maxLength={32} /></Field>
      </Form></Panel>
      : <div className="member-grid">{mess.people.map(person => <Panel title={person.name} key={person.id}>
      <p className="member-role">{mess.manager === person.id ? "Manager" : "Member"}</p><p>{person.email}</p>{person.phone && <p>{person.phone}</p>}
      {mess.manager !== person.id && <><h3>Permissions</h3>{manager ? <Form key={person.permissions.join(",")} save={save} label="Save permissions" action={f => ({ op: "permissions", member: person.id, permissions: f.getAll("permission") })}>
        {(["deposit", "meal", "expense"] as const).map(permission => <Check name="permission" key={permission} value={permission} checked={person.permissions.includes(permission)}>Record {permission}s</Check>)}
      </Form> : <p>{person.permissions.join(", ") || "Standard member access"}</p>}</>}
      {owner && person.id !== user.id && <button className="secondary" onClick={() => void save({ op: "memberReset", member: person.id })}>Generate password reset code</button>}
      <h3>Bazar dates</h3><BazarDates mess={mess} period={period} person={person} editable={manager || user.id === person.id} save={save} />
    </Panel>)}</div>}
  </div>;
}
function SettingsPage({ mess, manager, save }: { mess: Mess; manager: boolean; save: Save }) {
  if (!manager) return <Panel title="Mess settings"><p>Only the manager can edit mess settings.</p></Panel>;
  return <div className="columns">
    <Panel title="Mess preferences"><Form save={save} label="Save settings" action={f => ({ op: "settings", name: str(f, "name") })}>
      <Field label="Mess name"><input name="name" required minLength={2} maxLength={90} defaultValue={mess.name} /></Field>
    </Form></Panel>
    {mess.people.length === 1 && mess.periods.length <= 1 && mess.periods.every(period => !period.entries.length) && <Panel title="Import an existing ledger">
      <Form save={async payload => {
        const file = payload.file;
        let ledger: unknown = null;
        if (file instanceof File && file.size <= 110000) {
          try { ledger = JSON.parse(await file.text()); } catch {}
        }
        return save({ op: "import", ledger });
      }} label="Import ledger" action={f => ({ file: f.get("ledger") })}>
        <Field label="Ledger JSON"><input type="file" name="ledger" accept=".json,application/json" required /></Field>
      </Form>
    </Panel>}
  </div>;
}
function DeleteMess({ mess, manager, save }: { mess: Mess; manager: boolean; save: Save }) {
  return <Panel title="Delete mess">{manager ? <>
    <p>Permanently deletes the workspace and every accounting month.</p>
    <Form danger save={async payload => window.confirm("Permanently delete this mess and its ledger?") && await save(payload)} label="Delete mess" action={f => ({ op: "delete", name: str(f, "name") })}>
      <Field label="Type the mess name to confirm"><input name="name" required /></Field>
    </Form></> : <p>Only the manager can delete the mess.</p>}
  </Panel>;
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
  const [limit, setLimit] = useState(12);
  const updates = mess.periods.flatMap(period => period.entries)
    .filter(row => row.kind === "food" || user.id in (row.amounts ?? {}) || user.id in (row.counts ?? {}))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.date.localeCompare(a.date));
  return <section className="activity-feed" aria-label="Recent activity">
    {updates.length ? <ul>{updates.slice(0, limit).map(row => {
      const ownAmount = row.amounts?.[user.id] ?? 0;
      const ownCredit = row.credits?.[user.id] ?? 0;
      const Icon = row.kind === "meal" ? Soup : row.kind === "deposit" ? Wallet : ShoppingBasket;
      const message = {
        meal: () => quantity(totalMeals(row.counts?.[user.id] ?? zero)) + " meals recorded for you",
        deposit: () => money(Math.abs(ownAmount)) + (ownAmount < 0 ? " deducted from your deposits" : " added to your deposits"),
        food: () => money(row.cost ?? 0) + (row.shoppers?.includes(user.id) ? " spent on a bazar you shopped for" : " recorded as meal cost"),
        shared: () => money(ownAmount) + " charged to you for a shared expense",
        individual: () => money(ownAmount) + " charged to you for an individual expense",
      }[row.kind]();
      return <li className="activity-card" key={row.id}>
        <div className="activity-icon" data-kind={row.kind}><Icon size={22} aria-hidden /></div>
        <div><p className="activity-message">{message}</p>
          {row.note && <p>{row.note}</p>}
          {ownCredit > 0 && <p>{money(ownCredit)} credited to your deposits</p>}
          <footer><span>{kindLabels[row.kind]} · {nameOf(mess, row.actor)}</span><time dateTime={row.date}>{formatDate(row.date)}</time></footer>
        </div>
      </li>;
    })}</ul> : <p>No meal, deposit or expense updates to show.</p>}
    {updates.length > limit && <button className="secondary" onClick={() => setLimit(limit + 12)}>Load more</button>}
  </section>;
}
