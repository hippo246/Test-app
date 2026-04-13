import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────
// CREDENTIALS — change passwords here directly
// ─────────────────────────────────────────────
const CREDENTIALS = {
  admin: { password: "TAS@admin2026", role: "admin", name: "Admin" },
  agent: { password: "deliver123", role: "agent", name: "Delivery Agent" },
};

const PRODUCTS = [
  { id: "roti",     name: "Roti",                unit: "pcs", price: 6  },
  { id: "paratha5", name: "Paratha Pack (5 pcs)", unit: "pack", price: 75 },
  { id: "paratha10",name: "Paratha Pack (10 pcs)",unit: "pack", price: 140 },
];

// ─────────────────────────────────────────────
// PERSISTENCE
// ─────────────────────────────────────────────

// Wipe stale data from older versions that lack the new schema
const SCHEMA_VERSION = "v3";
if (localStorage.getItem("pcrm_schema") !== SCHEMA_VERSION) {
  ["pcrm_customers","pcrm_supplies","pcrm_deliveries","pcrm_expenses","pcrm_session"].forEach(k => localStorage.removeItem(k));
  localStorage.setItem("pcrm_schema", SCHEMA_VERSION);
}

function useLS(key, init) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; }
    catch { return init; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key, val]);
  return [val, setVal];
}

// Safe item getter — returns empty items object if missing
function safeItems(items) {
  return items && typeof items === "object" ? items : { roti: 0, paratha5: 0, paratha10: 0 };
}
function safeOrders(orders) {
  return orders && typeof orders === "object" ? orders : { roti: 0, paratha5: 0, paratha10: 0 };
}

// ─────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────
const SEED_CUSTOMERS = [
  { id: 1, name: "Hotel Saffron", phone: "9876543210", address: "MG Road, Panaji, Goa", lat: 15.4989, lng: 73.8278, orders: { roti: 20, paratha5: 4, paratha10: 0 }, paid: 1200, pending: 300, notes: "Prefers crispy", active: true, joinDate: "2026-01-01" },
  { id: 2, name: "Sharma Tiffin", phone: "9123456789", address: "Panaji Market, Goa",   lat: 15.5004, lng: 73.8212, orders: { roti: 0,  paratha5: 0, paratha10: 3 }, paid: 0, pending: 420, notes: "",             active: true, joinDate: "2026-02-15" },
];
const SEED_SUPPLIES = [
  { id: 1, item: "Wheat Flour", qty: 50, unit: "kg", date: "2026-04-10", supplier: "Ram Store", cost: 2000, notes: "" },
  { id: 2, item: "Oil (Refined)", qty: 20, unit: "L", date: "2026-04-11", supplier: "Agro Mart", cost: 1600, notes: "" },
];
const SEED_DELIVERIES = [
  { id: 1, customer: "Hotel Saffron", customerId: 1, items: { roti: 20, paratha5: 4, paratha10: 0 }, date: "2026-04-12", status: "Pending",   notes: "", address: "MG Road, Panaji, Goa", lat: 15.4989, lng: 73.8278 },
  { id: 2, customer: "Sharma Tiffin",  customerId: 2, items: { roti: 0,  paratha5: 0, paratha10: 3 }, date: "2026-04-12", status: "Delivered", notes: "", address: "Panaji Market, Goa",   lat: 15.5004, lng: 73.8212 },
];
const SEED_EXPENSES = [
  { id: 1, category: "Gas", amount: 800, date: "2026-04-10", notes: "Monthly LPG" },
];

// ─────────────────────────────────────────────
// TINY UI ATOMS
// ─────────────────────────────────────────────
const cls = (...a) => a.filter(Boolean).join(" ");

function Pill({ children, color = "stone" }) {
  const map = {
    stone:  "bg-stone-100 text-stone-600",
    amber:  "bg-amber-50  text-amber-700",
    green:  "bg-emerald-50 text-emerald-700",
    red:    "bg-red-50    text-red-600",
    sky:    "bg-sky-50    text-sky-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${map[color]}`}>{children}</span>;
}

function Field({ label, error, children }) {
  return (
    <div>
      {label && <label className="block text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1">{label}</label>}
      {children}
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function TextInput({ label, error, ...props }) {
  return (
    <Field label={label} error={error}>
      <input className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 outline-none focus:border-amber-400 focus:bg-white transition-all placeholder:text-stone-300" {...props} />
    </Field>
  );
}

function SelectInput({ label, children, ...props }) {
  return (
    <Field label={label}>
      <select className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 outline-none focus:border-amber-400 focus:bg-white transition-all" {...props}>
        {children}
      </select>
    </Field>
  );
}

function Btn({ children, onClick, variant = "primary", size = "md", className = "", disabled = false, type = "button" }) {
  const v = {
    primary: "bg-stone-900 text-white hover:bg-stone-700 active:scale-95",
    amber:   "bg-amber-500 text-white hover:bg-amber-600 active:scale-95",
    ghost:   "bg-stone-100 text-stone-600 hover:bg-stone-200 active:scale-95",
    danger:  "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 active:scale-95",
    success: "bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95",
    outline: "border border-stone-300 text-stone-700 hover:bg-stone-50 active:scale-95",
  };
  const s = { md: "px-4 py-2.5 text-sm", sm: "px-3 py-1.5 text-xs", lg: "px-5 py-3 text-base" };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={cls("font-semibold rounded-xl transition-all", v[variant], s[size], disabled && "opacity-40 cursor-not-allowed pointer-events-none", className)}>
      {children}
    </button>
  );
}

function Card({ children, className = "", onClick }) {
  return (
    <div onClick={onClick}
      className={cls("bg-white rounded-2xl border border-stone-100 shadow-sm", onClick && "cursor-pointer hover:shadow-md transition-shadow", className)}>
      {children}
    </div>
  );
}

function Divider() { return <div className="border-t border-stone-100" />; }

function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
      onTouchMove={e => e.stopPropagation()}
    >
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col" style={{ maxHeight: "92dvh" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          <span className="font-bold text-stone-800 text-base">{title}</span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 text-sm font-bold">✕</button>
        </div>
        <Divider />
        <div
          className="px-5 py-4 flex flex-col gap-3.5"
          style={{ overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); });
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] bg-stone-900 text-white text-sm px-5 py-2.5 rounded-full shadow-2xl font-medium whitespace-nowrap">
      {msg}
    </div>
  );
}

function StatTile({ label, value, sub, accent }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-4 shadow-sm" style={{ borderTopColor: accent, borderTopWidth: 3 }}>
      <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-stone-800 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-stone-400 mt-1">{sub}</p>}
    </div>
  );
}

// open address in Google Maps
function mapsLink(address, lat, lng) {
  if (lat && lng) return `https://maps.google.com/?q=${lat},${lng}`;
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}

// summarise order items
function orderSummary(rawItems) {
  const items = safeItems(rawItems);
  return PRODUCTS.filter(p => (items[p.id] || 0) > 0)
    .map(p => `${items[p.id]} ${p.name}`)
    .join(", ") || "—";
}

function orderValue(rawItems) {
  const items = safeItems(rawItems);
  return PRODUCTS.reduce((s, p) => s + (items[p.id] || 0) * p.price, 0);
}

// ─────────────────────────────────────────────
// LOGIN SCREEN
// ─────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  function attempt() {
    setLoading(true); setError("");
    setTimeout(() => {
      const cred = CREDENTIALS[username.toLowerCase().trim()];
      if (cred && cred.password === password) { onLogin({ username: username.toLowerCase().trim(), ...cred }); }
      else { setError("Incorrect username or password."); }
      setLoading(false);
    }, 600);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "#faf9f7" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">🫓</div>
          <h1 className="text-2xl font-bold text-stone-800 tracking-tight">TAS Healthy World</h1>
          <p className="text-stone-400 text-sm mt-1">Paratha Factory · Operations</p>
        </div>
        <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-6 flex flex-col gap-4">
          <TextInput label="Username" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin or agent" />
          <TextInput label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
            onKeyDown={e => e.key === "Enter" && attempt()} />
          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
          <Btn onClick={attempt} variant="primary" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign In →"}
          </Btn>
        </div>
        <p className="text-center text-[11px] text-stone-300 mt-6">Change passwords in the Admin → Settings panel</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useLS("pcrm_session", null);
  if (!session) return <LoginScreen onLogin={s => setSession(s)} />;
  return <CRM session={session} onLogout={() => setSession(null)} />;
}

function CRM({ session, onLogout }) {
  const isAdmin = session.role === "admin";

  const [customers,  setCustomers]  = useLS("pcrm_customers",  SEED_CUSTOMERS);
  const [supplies,   setSupplies]   = useLS("pcrm_supplies",   SEED_SUPPLIES);
  const [deliveries, setDeliveries] = useLS("pcrm_deliveries", SEED_DELIVERIES);
  const [expenses,   setExpenses]   = useLS("pcrm_expenses",   SEED_EXPENSES);

  const [tab,   setTab]   = useState(isAdmin ? "Dashboard" : "Deliveries");
  const [toast, setToast] = useState(null);
  const notify = (m) => setToast(m);

  // agent location
  const [agentLoc, setAgentLoc]     = useState(null);
  const [locError,  setLocError]    = useState(null);
  const [trackingOn, setTrackingOn] = useState(false);
  const watchRef = useRef(null);

  function startTracking() {
    if (!navigator.geolocation) { setLocError("Geolocation not supported"); return; }
    setTrackingOn(true);
    watchRef.current = navigator.geolocation.watchPosition(
      pos => setAgentLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy), time: new Date().toLocaleTimeString() }),
      err => setLocError(err.message),
      { enableHighAccuracy: true }
    );
  }
  function stopTracking() {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    setTrackingOn(false); setAgentLoc(null);
  }
  useEffect(() => () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current); }, []);

  // ── STATS ──
  const active = customers.filter(c => c.active);
  const totalRevenue  = customers.reduce((a,c) => a + c.paid,    0);
  const totalDue      = customers.reduce((a,c) => a + c.pending, 0);
  const totalExpenses = expenses.reduce((a,e)  => a + e.amount,  0);
  const supplyCost    = supplies.reduce((a,s)  => a + (s.cost||0), 0);
  const netProfit     = totalRevenue - totalExpenses - supplyCost;
  const pendingDelivs = deliveries.filter(d => d.status === "Pending");

  // ── CUSTOMER CRUD ──
  const blankC = { name:"", phone:"", address:"", lat:"", lng:"", orders:{ roti:0, paratha5:0, paratha10:0 }, paid:0, pending:0, notes:"", active:true, joinDate: new Date().toISOString().slice(0,10) };
  const [cSheet, setCSheet] = useState(null);
  const [cForm,  setCForm]  = useState(blankC);
  const [cView,  setCView]  = useState(null);
  const [paySheet, setPaySheet] = useState(null);
  const [payAmt, setPayAmt]    = useState("");

  function openAddC()  { setCForm({...blankC}); setCSheet("add"); }
  function openEditC(c){ setCForm({...c});       setCSheet(c); }

  function saveC() {
    if (!cForm.name.trim()) return;
    const rec = { ...cForm, lat: +cForm.lat||0, lng: +cForm.lng||0, paid: +cForm.paid||0, pending: +cForm.pending||0,
      orders: { roti:+cForm.orders.roti||0, paratha5:+cForm.orders.paratha5||0, paratha10:+cForm.orders.paratha10||0 } };
    if (cSheet === "add") { setCustomers([...customers, { ...rec, id: Date.now() }]); notify("Customer added ✓"); }
    else { setCustomers(customers.map(c => c.id===cSheet.id ? { ...rec, id:c.id } : c)); notify("Customer updated ✓"); }
    setCSheet(null);
  }
  function deleteC(id) { if (!window.confirm("Delete customer?")) return; setCustomers(customers.filter(c=>c.id!==id)); notify("Deleted"); }
  function toggleActive(id) { setCustomers(customers.map(c => c.id===id ? {...c,active:!c.active} : c)); }
  function recordPay() {
    const a = +payAmt; if (!a||!paySheet) return;
    setCustomers(customers.map(c => c.id===paySheet.id ? {...c, paid:c.paid+a, pending:Math.max(0,c.pending-a)} : c));
    notify(`₹${a} recorded`); setPaySheet(null); setPayAmt("");
  }

  // ── SUPPLY CRUD ──
  const blankS = { item:"", qty:"", unit:"kg", date:new Date().toISOString().slice(0,10), supplier:"", cost:"", notes:"" };
  const [sSheet, setSSheet] = useState(null);
  const [sForm,  setSForm]  = useState(blankS);
  function openAddS()  { setSForm({...blankS}); setSSheet("add"); }
  function openEditS(s){ setSForm({...s});       setSSheet(s); }
  function saveS() {
    if (!sForm.item.trim()) return;
    const rec = { ...sForm, qty:+sForm.qty||0, cost:+sForm.cost||0 };
    if (sSheet==="add") { setSupplies([...supplies,{...rec,id:Date.now()}]); notify("Supply logged ✓"); }
    else { setSupplies(supplies.map(s => s.id===sSheet.id ? {...rec,id:s.id} : s)); notify("Supply updated ✓"); }
    setSSheet(null);
  }
  function deleteS(id) { setSupplies(supplies.filter(s=>s.id!==id)); notify("Removed"); }

  // ── DELIVERY CRUD ──
  const blankD = { customer:"", customerId:null, items:{ roti:0,paratha5:0,paratha10:0 }, date:new Date().toISOString().slice(0,10), status:"Pending", notes:"", address:"", lat:0, lng:0 };
  const [dSheet, setDSheet] = useState(null);
  const [dForm,  setDForm]  = useState(blankD);
  function openAddD()  { setDForm({...blankD}); setDSheet("add"); }
  function openEditD(d){ setDForm({...d});       setDSheet(d); }
  function pickCustomerForDelivery(name) {
    const c = customers.find(x=>x.name===name);
    setDForm(f => ({ ...f, customer:name, customerId:c?.id||null, address:c?.address||"", lat:c?.lat||0, lng:c?.lng||0,
      items:{ roti:c?.orders.roti||0, paratha5:c?.orders.paratha5||0, paratha10:c?.orders.paratha10||0 } }));
  }
  function saveD() {
    if (!dForm.customer) return;
    const rec = { ...dForm, items:{ roti:+dForm.items.roti||0, paratha5:+dForm.items.paratha5||0, paratha10:+dForm.items.paratha10||0 } };
    if (dSheet==="add") { setDeliveries([...deliveries,{...rec,id:Date.now()}]); notify("Delivery added ✓"); }
    else { setDeliveries(deliveries.map(d => d.id===dSheet.id ? {...rec,id:d.id} : d)); notify("Delivery updated ✓"); }
    setDSheet(null);
  }
  function toggleD(id) { setDeliveries(deliveries.map(d => d.id===id ? {...d, status:d.status==="Pending"?"Delivered":"Pending"} : d)); notify("Status updated"); }
  function deleteD(id) { setDeliveries(deliveries.filter(d=>d.id!==id)); notify("Removed"); }

  // ── EXPENSE CRUD ──
  const blankE = { category:"Gas", amount:"", date:new Date().toISOString().slice(0,10), notes:"" };
  const [eSheet, setESheet] = useState(null);
  const [eForm,  setEForm]  = useState(blankE);
  function saveE() { if(!eForm.amount) return; setExpenses([...expenses,{...eForm,id:Date.now(),amount:+eForm.amount}]); notify("Expense logged ✓"); setESheet(null); }
  function deleteE(id) { setExpenses(expenses.filter(e=>e.id!==id)); notify("Removed"); }

  // ── CHANGE PASSWORD (admin) ──
  const [pwSheet, setPwSheet] = useState(false);
  const [pwForm,  setPwForm]  = useState({ target:"agent", newPw:"", confirm:"" });
  const [pwErr,   setPwErr]   = useState("");
  function changePw() {
    if (pwForm.newPw.length < 6)      { setPwErr("Minimum 6 characters"); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwErr("Passwords don't match"); return; }
    CREDENTIALS[pwForm.target].password = pwForm.newPw;
    notify(`${pwForm.target} password updated ✓`); setPwSheet(false); setPwErr("");
  }

  const ADMIN_TABS = ["Dashboard","Customers","Deliveries","Supplies","Expenses","Settings"];
  const AGENT_TABS = ["Deliveries","Customers"];
  const TABS = isAdmin ? ADMIN_TABS : AGENT_TABS;

  return (
    <div className="min-h-screen pb-28" style={{ background:"#faf9f7", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>

      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-white border-b border-stone-100 shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🫓</span>
            <div>
              <p className="font-bold text-stone-800 text-sm leading-tight">TAS Healthy World</p>
              <p className="text-[11px] text-stone-400">{session.name} · {isAdmin ? "Admin" : "Agent"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isAdmin && (
              trackingOn
                ? <button onClick={stopTracking} className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">📍 Live</button>
                : <button onClick={startTracking} className="text-[11px] px-2.5 py-1 rounded-full bg-stone-100 text-stone-500 font-semibold">📍 Track me</button>
            )}
            {isAdmin && agentLoc && (
              <a href={mapsLink("",agentLoc.lat,agentLoc.lng)} target="_blank" rel="noopener noreferrer"
                className="text-[11px] px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 font-semibold border border-sky-100">
                🗺 Agent
              </a>
            )}
            <button onClick={onLogout} className="text-[11px] px-2.5 py-1 rounded-full bg-stone-100 text-stone-500 font-semibold">Sign out</button>
          </div>
        </div>
        {/* TABS */}
        <div className="max-w-xl mx-auto px-4 pb-2.5 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cls("whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
                tab===t ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100")}>
              {t}
            </button>
          ))}
        </div>
      </header>

      {/* agent location bar */}
      {!isAdmin && trackingOn && agentLoc && (
        <div className="max-w-xl mx-auto px-4 pt-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700">📍 Location active — {agentLoc.time}</p>
              <p className="text-[11px] text-emerald-500">{agentLoc.lat.toFixed(5)}, {agentLoc.lng.toFixed(5)} · ±{agentLoc.acc}m</p>
            </div>
            <a href={mapsLink("",agentLoc.lat,agentLoc.lng)} target="_blank" rel="noopener noreferrer"
              className="text-xs font-semibold text-emerald-700 underline underline-offset-2">Open Maps</a>
          </div>
        </div>
      )}

      <div className="max-w-xl mx-auto px-4 py-4 flex flex-col gap-3">

        {/* ═══════════════ DASHBOARD ═══════════════ */}
        {tab==="Dashboard" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Active Customers" value={active.length}           sub={`${customers.length} total`}            accent="#d97706" />
              <StatTile label="Pending Deliveries" value={pendingDelivs.length}  sub={`${deliveries.filter(d=>d.status==="Delivered").length} done`} accent="#ef4444" />
              <StatTile label="Revenue"    value={`₹${totalRevenue.toLocaleString()}`}  sub="Collected"   accent="#10b981" />
              <StatTile label="Amount Due" value={`₹${totalDue.toLocaleString()}`}      sub="Outstanding" accent="#8b5cf6" />
              <StatTile label="Total Costs" value={`₹${(totalExpenses+supplyCost).toLocaleString()}`} sub="Supplies + ops" accent="#f59e0b" />
              <StatTile label="Net Profit"  value={`₹${netProfit.toLocaleString()}`}    sub="Revenue − costs" accent={netProfit>=0?"#10b981":"#ef4444"} />
            </div>

            {/* Today's pending */}
            <Card>
              <div className="px-4 pt-4 pb-2">
                <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Pending Deliveries</p>
              </div>
              <Divider />
              {pendingDelivs.length===0
                ? <p className="text-sm text-stone-400 text-center py-5">All deliveries completed 🎉</p>
                : pendingDelivs.map((d,i) => (
                  <div key={d.id}>
                    {i>0 && <Divider />}
                    <div className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-stone-800">{d.customer}</p>
                        <p className="text-xs text-stone-400">{orderSummary(d.items)} · {d.date}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={mapsLink(d.address,d.lat,d.lng)} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-semibold text-sky-600 underline underline-offset-2">Maps</a>
                        <button onClick={()=>toggleD(d.id)} className="text-xs font-semibold px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition-colors">Done ✓</button>
                      </div>
                    </div>
                  </div>
                ))
              }
            </Card>

            {/* Due payments */}
            {customers.filter(c=>c.pending>0).length > 0 && (
              <Card>
                <div className="px-4 pt-4 pb-2">
                  <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Outstanding Payments</p>
                </div>
                <Divider />
                {customers.filter(c=>c.pending>0).map((c,i,a) => (
                  <div key={c.id}>
                    {i>0 && <Divider />}
                    <div className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-stone-800">{c.name}</p>
                        <p className="text-xs text-red-500 font-semibold">₹{c.pending.toLocaleString()} due</p>
                      </div>
                      <button onClick={()=>{setPaySheet(c);setPayAmt("")}} className="text-xs font-semibold px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">+ Pay</button>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}

        {/* ═══════════════ CUSTOMERS ═══════════════ */}
        {tab==="Customers" && (
          <>
            <div className="flex gap-2 items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                <Pill color="amber">{active.length} active</Pill>
                <Pill color="stone">{customers.filter(c=>!c.active).length} inactive</Pill>
              </div>
              <Btn onClick={openAddC} size="sm" variant="primary">+ Customer</Btn>
            </div>

            {customers.length===0 && <p className="text-center text-stone-400 text-sm py-10">No customers yet.</p>}

            {customers.map(c => (
              <Card key={c.id}>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-stone-800">{c.name}</p>
                      <p className="text-xs text-stone-400">{c.phone}{c.phone&&c.address?" · ":""}{c.address}</p>
                    </div>
                    <Pill color={c.active?"green":"stone"}>{c.active?"Active":"Inactive"}</Pill>
                  </div>

                  {/* product order summary */}
                  <div className="bg-stone-50 rounded-xl p-3 mb-3">
                    <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Regular Order</p>
                    <div className="flex gap-3 flex-wrap">
                      {PRODUCTS.map(p => (
                        <div key={p.id} className="text-center">
                          <p className="text-base font-bold text-stone-800">{safeOrders(c.orders)[p.id]||0}</p>
                          <p className="text-[10px] text-stone-400">{p.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 mb-3">
                    <div className="flex-1 bg-emerald-50 rounded-xl p-2.5 text-center">
                      <p className="font-bold text-emerald-700 text-base">₹{c.paid.toLocaleString()}</p>
                      <p className="text-[10px] text-stone-400">Paid</p>
                    </div>
                    <div className="flex-1 rounded-xl p-2.5 text-center" style={{background: c.pending>0?"#fef2f2":"#f0fdf4"}}>
                      <p className={cls("font-bold text-base", c.pending>0?"text-red-500":"text-emerald-600")}>₹{c.pending.toLocaleString()}</p>
                      <p className="text-[10px] text-stone-400">Pending</p>
                    </div>
                    <div className="flex-1 bg-stone-50 rounded-xl p-2.5 text-center">
                      <p className="font-bold text-stone-700 text-base">₹{orderValue(safeOrders(c.orders)).toLocaleString()}</p>
                      <p className="text-[10px] text-stone-400">Order Value</p>
                    </div>
                  </div>

                  {c.notes && <p className="text-xs text-stone-400 italic mb-3">"{c.notes}"</p>}

                  <div className="flex gap-2 flex-wrap">
                    <button onClick={()=>setCView(c)} className="text-xs font-semibold px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg">View</button>
                    {(isAdmin || !isAdmin) && (
                      <button onClick={()=>openEditC(c)} className="text-xs font-semibold px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg">Edit</button>
                    )}
                    {isAdmin && <>
                      <button onClick={()=>{setPaySheet(c);setPayAmt("")}} className="text-xs font-semibold px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg">+ Pay</button>
                      <button onClick={()=>toggleActive(c.id)} className="text-xs font-semibold px-3 py-1.5 bg-sky-50 text-sky-700 rounded-lg">{c.active?"Deactivate":"Activate"}</button>
                      <button onClick={()=>deleteC(c.id)} className="text-xs font-semibold px-3 py-1.5 bg-red-50 text-red-500 rounded-lg">Delete</button>
                    </>}
                    {c.address && (
                      <a href={mapsLink(c.address,c.lat,c.lng)} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-semibold px-3 py-1.5 bg-sky-50 text-sky-700 rounded-lg">📍 Maps</a>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}

        {/* ═══════════════ DELIVERIES ═══════════════ */}
        {tab==="Deliveries" && (
          <>
            <div className="flex gap-2 items-center justify-between flex-wrap">
              <div className="flex gap-2">
                <Pill color="amber">{deliveries.filter(d=>d.status==="Pending").length} pending</Pill>
                <Pill color="green">{deliveries.filter(d=>d.status==="Delivered").length} done</Pill>
              </div>
              <Btn onClick={openAddD} size="sm" variant="primary">+ Delivery</Btn>
            </div>

            {deliveries.length===0 && <p className="text-center text-stone-400 text-sm py-10">No deliveries logged.</p>}

            {deliveries.map(d => (
              <Card key={d.id}>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-stone-800">{d.customer}</p>
                      <p className="text-xs text-stone-400">{d.date}</p>
                    </div>
                    <button onClick={()=>toggleD(d.id)}>
                      <Pill color={d.status==="Delivered"?"green":"amber"}>{d.status}</Pill>
                    </button>
                  </div>

                  {/* items */}
                  <div className="bg-stone-50 rounded-xl px-3 py-2.5 mb-3 flex gap-4 flex-wrap">
                    {PRODUCTS.map(p => (d.items[p.id]||0) > 0 && (
                      <div key={p.id}>
                        <span className="font-bold text-stone-800 text-sm">{d.items[p.id]}</span>
                        <span className="text-[11px] text-stone-400 ml-1">{p.name}</span>
                      </div>
                    ))}
                    <div className="ml-auto">
                      <span className="text-xs font-bold text-stone-600">₹{orderValue(d.items).toLocaleString()}</span>
                    </div>
                  </div>

                  {d.notes && <p className="text-xs text-stone-400 italic mb-2">"{d.notes}"</p>}

                  <div className="flex gap-2 flex-wrap">
                    {d.address && (
                      <a href={mapsLink(d.address,d.lat,d.lng)} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-semibold px-3 py-1.5 bg-sky-50 text-sky-700 rounded-lg">📍 Navigate</a>
                    )}
                    <button onClick={()=>openEditD(d)} className="text-xs font-semibold px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg">Edit</button>
                    {isAdmin && <button onClick={()=>deleteD(d.id)} className="text-xs font-semibold px-3 py-1.5 bg-red-50 text-red-500 rounded-lg">Delete</button>}
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}

        {/* ═══════════════ SUPPLIES ═══════════════ */}
        {tab==="Supplies" && isAdmin && (
          <>
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Pill color="amber">{supplies.length} items</Pill>
                <Pill color="purple">₹{supplyCost.toLocaleString()} cost</Pill>
              </div>
              <Btn onClick={openAddS} size="sm" variant="primary">+ Supply</Btn>
            </div>
            {supplies.map(s => (
              <Card key={s.id}>
                <div className="p-4 flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-stone-800">{s.item}</p>
                    <p className="text-xs text-stone-400">{s.supplier}{s.supplier&&s.date?" · ":""}{s.date}</p>
                    {s.notes && <p className="text-xs text-stone-400 italic mt-0.5">"{s.notes}"</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-stone-800">{s.qty} <span className="text-xs text-stone-400 font-normal">{s.unit}</span></p>
                    {s.cost>0 && <p className="text-xs text-stone-400">₹{s.cost.toLocaleString()}</p>}
                    <div className="flex gap-1.5 justify-end mt-2">
                      <button onClick={()=>openEditS(s)} className="text-[11px] font-semibold px-2 py-1 bg-amber-50 text-amber-700 rounded-lg">Edit</button>
                      <button onClick={()=>deleteS(s.id)} className="text-[11px] font-semibold px-2 py-1 bg-red-50 text-red-500 rounded-lg">✕</button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}

        {/* ═══════════════ EXPENSES ═══════════════ */}
        {tab==="Expenses" && isAdmin && (
          <>
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Pill color="red">₹{totalExpenses.toLocaleString()} ops</Pill>
                <Pill color={netProfit>=0?"green":"red"}>Profit ₹{netProfit.toLocaleString()}</Pill>
              </div>
              <Btn onClick={()=>{setEForm({...blankE});setESheet("add")}} size="sm" variant="primary">+ Expense</Btn>
            </div>

            <Card>
              <div className="p-4 flex flex-col gap-2">
                {[
                  { label:"Supply costs",  val:supplyCost,    c:"#8b5cf6" },
                  { label:"Op expenses",   val:totalExpenses, c:"#ef4444" },
                  { label:"Total revenue", val:totalRevenue,  c:"#10b981" },
                  { label:"Net profit",    val:netProfit,     c:netProfit>=0?"#10b981":"#ef4444" },
                ].map(x=>(
                  <div key={x.label} className="flex justify-between items-center py-1.5 border-b border-stone-50 last:border-0">
                    <span className="text-sm text-stone-500">{x.label}</span>
                    <span className="font-bold text-sm" style={{color:x.c}}>₹{x.val.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </Card>

            {expenses.map(e=>(
              <Card key={e.id}>
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-stone-800">{e.category}</p>
                    <p className="text-xs text-stone-400">{e.date}{e.notes?" · "+e.notes:""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-red-500">₹{e.amount.toLocaleString()}</span>
                    <button onClick={()=>deleteE(e.id)} className="text-[11px] font-semibold px-2 py-1 bg-red-50 text-red-500 rounded-lg">✕</button>
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}

        {/* ═══════════════ SETTINGS ═══════════════ */}
        {tab==="Settings" && isAdmin && (
          <>
            <Card>
              <div className="p-4 flex flex-col gap-4">
                <div>
                  <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-3">Change Password</p>
                  <div className="flex flex-col gap-3">
                    <SelectInput label="Account" value={pwForm.target} onChange={e=>setPwForm({...pwForm,target:e.target.value})}>
                      <option value="agent">Delivery Agent</option>
                      <option value="admin">Admin</option>
                    </SelectInput>
                    <TextInput label="New Password" type="password" value={pwForm.newPw} onChange={e=>setPwForm({...pwForm,newPw:e.target.value})} placeholder="Min 6 characters" />
                    <TextInput label="Confirm Password" type="password" value={pwForm.confirm} onChange={e=>setPwForm({...pwForm,confirm:e.target.value})} placeholder="Repeat password" />
                    {pwErr && <p className="text-xs text-red-500 font-semibold">{pwErr}</p>}
                    <Btn onClick={changePw} variant="primary" className="w-full">Update Password</Btn>
                    <p className="text-[11px] text-stone-300 text-center">Note: password resets after page refresh — for permanent changes, update the CREDENTIALS object in the code.</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-3">Products</p>
                {PRODUCTS.map(p=>(
                  <div key={p.id} className="flex justify-between items-center py-2 border-b border-stone-50 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-stone-800">{p.name}</p>
                      <p className="text-xs text-stone-400">{p.unit}</p>
                    </div>
                    <span className="font-bold text-stone-700">₹{p.price}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Data</p>
                <div className="flex flex-col gap-2 mb-4">
                  {[["Customers",customers.length],["Supplies",supplies.length],["Deliveries",deliveries.length],["Expenses",expenses.length]].map(([k,v])=>(
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-stone-500">{k}</span>
                      <span className="font-bold text-stone-700">{v}</span>
                    </div>
                  ))}
                </div>
                <Btn onClick={()=>{ if(window.confirm("Reset all data?")){ setCustomers(SEED_CUSTOMERS);setSupplies(SEED_SUPPLIES);setDeliveries(SEED_DELIVERIES);setExpenses(SEED_EXPENSES);notify("Data reset");}}} variant="danger" className="w-full">
                  ⚠️ Reset All Data
                </Btn>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* ═════════════════════════════════════════
          SHEETS
      ═══════════════════════════════════════════ */}

      {/* Customer Sheet */}
      <Sheet open={!!cSheet} onClose={()=>setCSheet(null)} title={cSheet==="add"?"New Customer":"Edit Customer"}>
        <TextInput label="Name *" value={cForm.name} onChange={e=>setCForm({...cForm,name:e.target.value})} placeholder="Customer or business name" />
        <TextInput label="Phone" value={cForm.phone} onChange={e=>setCForm({...cForm,phone:e.target.value})} placeholder="Mobile number" />
        <TextInput label="Address" value={cForm.address} onChange={e=>setCForm({...cForm,address:e.target.value})} placeholder="Full delivery address" />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="GPS Latitude" value={cForm.lat} onChange={e=>setCForm({...cForm,lat:e.target.value})} placeholder="e.g. 15.4989" />
          <TextInput label="GPS Longitude" value={cForm.lng} onChange={e=>setCForm({...cForm,lng:e.target.value})} placeholder="e.g. 73.8278" />
        </div>
        <p className="text-[11px] text-stone-400">Tip: get lat/lng from Google Maps by long-pressing a location.</p>

        <Divider />
        <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Regular Order Quantities</p>
        {PRODUCTS.map(p=>(
          <div key={p.id} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-700">{p.name}</p>
              <p className="text-[11px] text-stone-400">₹{p.price}/{p.unit}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={()=>setCForm({...cForm,orders:{...cForm.orders,[p.id]:Math.max(0,((cForm.orders&&cForm.orders[p.id])||0)-1)}})}
                className="w-8 h-8 rounded-xl bg-stone-100 text-stone-600 font-bold text-lg flex items-center justify-center">−</button>
              <span className="w-8 text-center font-bold text-stone-800">{(cForm.orders&&cForm.orders[p.id])||0}</span>
              <button onClick={()=>setCForm({...cForm,orders:{...cForm.orders,[p.id]:((cForm.orders&&cForm.orders[p.id])||0)+1}})}
                className="w-8 h-8 rounded-xl bg-stone-900 text-white font-bold text-lg flex items-center justify-center">+</button>
            </div>
          </div>
        ))}

        <Divider />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Amount Paid (₹)" type="number" value={cForm.paid} onChange={e=>setCForm({...cForm,paid:e.target.value})} />
          <TextInput label="Amount Pending (₹)" type="number" value={cForm.pending} onChange={e=>setCForm({...cForm,pending:e.target.value})} />
        </div>
        <TextInput label="Notes" value={cForm.notes} onChange={e=>setCForm({...cForm,notes:e.target.value})} placeholder="Special instructions…" />
        <SelectInput label="Status" value={cForm.active?"active":"inactive"} onChange={e=>setCForm({...cForm,active:e.target.value==="active"})}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </SelectInput>
        <Btn onClick={saveC} variant="primary" className="w-full">Save Customer</Btn>
      </Sheet>

      {/* Customer View Sheet */}
      <Sheet open={!!cView} onClose={()=>setCView(null)} title="Customer Profile">
        {cView && <>
          <div className="flex items-center gap-3 pb-1">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-xl font-bold text-amber-700">
              {cView.name[0]}
            </div>
            <div>
              <p className="font-bold text-stone-800">{cView.name}</p>
              <p className="text-xs text-stone-400">{cView.phone}</p>
            </div>
          </div>
          <Divider />
          {[["Address",cView.address||"—"],["Joined",cView.joinDate||"—"],["Notes",cView.notes||"—"]].map(([k,v])=>(
            <div key={k} className="flex justify-between text-sm py-1">
              <span className="text-stone-400 font-medium">{k}</span>
              <span className="text-stone-700 font-semibold text-right max-w-[60%]">{v}</span>
            </div>
          ))}
          <Divider />
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Regular Order</p>
          {PRODUCTS.map(p=>(
            <div key={p.id} className="flex justify-between text-sm py-1">
              <span className="text-stone-500">{p.name}</span>
              <span className="font-bold text-stone-800">{safeOrders(cView.orders)[p.id]||0} <span className="text-stone-400 font-normal">{p.unit}</span></span>
            </div>
          ))}
          <div className="bg-stone-50 rounded-xl p-3 text-sm">
            <div className="flex justify-between"><span className="text-stone-500">Order value</span><span className="font-bold">₹{orderValue(safeOrders(cView.orders)).toLocaleString()}</span></div>
            <div className="flex justify-between mt-1"><span className="text-stone-500">Paid</span><span className="font-bold text-emerald-600">₹{cView.paid.toLocaleString()}</span></div>
            <div className="flex justify-between mt-1"><span className="text-stone-500">Pending</span><span className={cls("font-bold", cView.pending>0?"text-red-500":"text-emerald-600")}>₹{cView.pending.toLocaleString()}</span></div>
          </div>
          <Divider />
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Delivery History</p>
          {deliveries.filter(d=>d.customerId===cView.id).length===0
            ? <p className="text-xs text-stone-400">No deliveries yet.</p>
            : deliveries.filter(d=>d.customerId===cView.id).map(d=>(
              <div key={d.id} className="flex justify-between text-xs py-1.5 border-b border-stone-50 last:border-0">
                <span className="text-stone-500">{d.date} — {orderSummary(d.items)}</span>
                <Pill color={d.status==="Delivered"?"green":"amber"}>{d.status}</Pill>
              </div>
            ))
          }
          {cView.address && (
            <a href={mapsLink(cView.address,cView.lat,cView.lng)} target="_blank" rel="noopener noreferrer">
              <Btn variant="outline" className="w-full">📍 Open in Google Maps</Btn>
            </a>
          )}
        </>}
      </Sheet>

      {/* Supply Sheet */}
      <Sheet open={!!sSheet} onClose={()=>setSSheet(null)} title={sSheet==="add"?"Log Supply":"Edit Supply"}>
        <TextInput label="Item Name *" value={sForm.item} onChange={e=>setSForm({...sForm,item:e.target.value})} placeholder="e.g. Wheat Flour" />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Quantity" type="number" value={sForm.qty} onChange={e=>setSForm({...sForm,qty:e.target.value})} />
          <SelectInput label="Unit" value={sForm.unit} onChange={e=>setSForm({...sForm,unit:e.target.value})}>
            {["kg","g","L","mL","pcs","bags","boxes","dozen"].map(u=><option key={u}>{u}</option>)}
          </SelectInput>
        </div>
        <TextInput label="Supplier" value={sForm.supplier} onChange={e=>setSForm({...sForm,supplier:e.target.value})} />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Cost (₹)" type="number" value={sForm.cost} onChange={e=>setSForm({...sForm,cost:e.target.value})} />
          <TextInput label="Date" type="date" value={sForm.date} onChange={e=>setSForm({...sForm,date:e.target.value})} />
        </div>
        <TextInput label="Notes" value={sForm.notes} onChange={e=>setSForm({...sForm,notes:e.target.value})} />
        <Btn onClick={saveS} variant="primary" className="w-full">Save Supply</Btn>
      </Sheet>

      {/* Delivery Sheet */}
      <Sheet open={!!dSheet} onClose={()=>setDSheet(null)} title={dSheet==="add"?"New Delivery":"Edit Delivery"}>
        <SelectInput label="Customer *" value={dForm.customer} onChange={e=>pickCustomerForDelivery(e.target.value)}>
          <option value="">— Select customer —</option>
          {customers.filter(c=>c.active).map(c=><option key={c.id}>{c.name}</option>)}
        </SelectInput>
        {dForm.address && (
          <div className="bg-sky-50 rounded-xl px-3.5 py-2.5 text-xs text-sky-700 font-medium flex items-center justify-between">
            <span>📍 {dForm.address}</span>
            <a href={mapsLink(dForm.address,dForm.lat,dForm.lng)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 font-semibold ml-2 shrink-0">Maps</a>
          </div>
        )}

        <Divider />
        <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Items to Deliver</p>
        {PRODUCTS.map(p=>(
          <div key={p.id} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-700">{p.name}</p>
              <p className="text-[11px] text-stone-400">₹{p.price}/{p.unit}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={()=>setDForm({...dForm,items:{...dForm.items,[p.id]:Math.max(0,((dForm.items&&dForm.items[p.id])||0)-1)}})}
                className="w-8 h-8 rounded-xl bg-stone-100 text-stone-600 font-bold text-lg flex items-center justify-center">−</button>
              <span className="w-8 text-center font-bold text-stone-800">{(dForm.items&&dForm.items[p.id])||0}</span>
              <button onClick={()=>setDForm({...dForm,items:{...dForm.items,[p.id]:((dForm.items&&dForm.items[p.id])||0)+1}})}
                className="w-8 h-8 rounded-xl bg-stone-900 text-white font-bold text-lg flex items-center justify-center">+</button>
            </div>
          </div>
        ))}
        {orderValue(dForm.items)>0 && (
          <div className="bg-stone-50 rounded-xl px-3.5 py-2.5 flex justify-between text-sm">
            <span className="text-stone-500">Delivery value</span>
            <span className="font-bold text-stone-800">₹{orderValue(dForm.items).toLocaleString()}</span>
          </div>
        )}
        <Divider />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Date" type="date" value={dForm.date} onChange={e=>setDForm({...dForm,date:e.target.value})} />
          <SelectInput label="Status" value={dForm.status} onChange={e=>setDForm({...dForm,status:e.target.value})}>
            <option>Pending</option>
            <option>Delivered</option>
          </SelectInput>
        </div>
        <TextInput label="Notes" value={dForm.notes} onChange={e=>setDForm({...dForm,notes:e.target.value})} placeholder="e.g. Leave at gate" />
        <Btn onClick={saveD} variant="primary" className="w-full">Save Delivery</Btn>
      </Sheet>

      {/* Expense Sheet */}
      <Sheet open={!!eSheet} onClose={()=>setESheet(null)} title="Log Expense">
        <SelectInput label="Category" value={eForm.category} onChange={e=>setEForm({...eForm,category:e.target.value})}>
          {["Gas","Labour","Transport","Packaging","Utilities","Maintenance","Other"].map(c=><option key={c}>{c}</option>)}
        </SelectInput>
        <TextInput label="Amount (₹) *" type="number" value={eForm.amount} onChange={e=>setEForm({...eForm,amount:e.target.value})} />
        <TextInput label="Date" type="date" value={eForm.date} onChange={e=>setEForm({...eForm,date:e.target.value})} />
        <TextInput label="Notes" value={eForm.notes} onChange={e=>setEForm({...eForm,notes:e.target.value})} placeholder="Description…" />
        <Btn onClick={saveE} variant="primary" className="w-full">Save Expense</Btn>
      </Sheet>

      {/* Pay Sheet */}
      <Sheet open={!!paySheet} onClose={()=>{setPaySheet(null);setPayAmt("")}} title="Record Payment">
        {paySheet && <>
          <p className="text-sm font-semibold text-stone-700">{paySheet.name}</p>
          <div className="flex gap-3">
            <span className="text-sm text-emerald-600 font-bold">Paid: ₹{paySheet.paid.toLocaleString()}</span>
            <span className="text-sm text-red-500 font-bold">Due: ₹{paySheet.pending.toLocaleString()}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[paySheet.pending,500,1000,2000].filter((v,i,a)=>v>0&&a.indexOf(v)===i).map(q=>(
              <button key={q} onClick={()=>setPayAmt(String(q))}
                className={cls("text-xs font-semibold px-3 py-1.5 rounded-lg transition-all", payAmt===String(q)?"bg-stone-900 text-white":"bg-stone-100 text-stone-600")}>
                ₹{q.toLocaleString()}
              </button>
            ))}
          </div>
          <TextInput label="Amount Received (₹)" type="number" value={payAmt} onChange={e=>setPayAmt(e.target.value)} placeholder="Enter amount" />
          <div className="flex gap-2">
            <Btn onClick={()=>{setPaySheet(null);setPayAmt("")}} variant="ghost" className="flex-1">Cancel</Btn>
            <Btn onClick={recordPay} variant="success" className="flex-1" disabled={!payAmt}>Confirm ₹{payAmt||0}</Btn>
          </div>
        </>}
      </Sheet>

      {toast && <Toast msg={toast} onDone={()=>setToast(null)} />}
    </div>
  );
}
