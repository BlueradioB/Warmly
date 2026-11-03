const STORAGE_KEY = "warmly-crm-v1";

const initialState = {
  customFields: [],
  contacts: [
    { id: "c1", name: "Amara Johnson", email: "amara.j@email.com", company: "Fieldwork Studio", role: "Creative director", relationship: "Friend", notes: "Met at the Portland design meetup. Loves a good bookstore recommendation.", createdAt: "2026-03-17", activities: [{ type: "call", date: "2026-11-01", note: "Caught up over a walk" }, { type: "response", date: "2026-10-28", note: "Replied to my note" }, { type: "outreach", date: "2026-10-27", note: "Shared an article" }], custom: {} },
    { id: "c2", name: "Theo Martinez", email: "theo.m@northstar.io", company: "Northstar", role: "Product lead", relationship: "Former colleague", notes: "Worked together at Lumen. Check in about the new role.", createdAt: "2026-04-04", activities: [{ type: "connection", date: "2026-10-30", note: "Coffee downtown" }, { type: "outreach", date: "2026-10-25", note: "Sent a quick hello" }], custom: {} },
    { id: "c3", name: "Priya Shah", email: "priya@studioarc.com", company: "Studio Arc", role: "Founder", relationship: "Professional", notes: "Interested in collaborating on the community event.", createdAt: "2026-05-22", activities: [{ type: "response", date: "2026-10-21", note: "Replied about the event" }, { type: "outreach", date: "2026-10-20", note: "Followed up on the introduction" }], custom: {} },
    { id: "c4", name: "Leo Park", email: "leo.park@email.com", company: "—", role: "Photographer", relationship: "Friend", notes: "Has a great eye for the little things. Ask about the coast trip.", createdAt: "2026-06-08", activities: [{ type: "call", date: "2026-10-16", note: "Long overdue catch-up" }], custom: {} },
    { id: "c5", name: "Nina Williams", email: "nina@kindred.co", company: "Kindred Co.", role: "Community builder", relationship: "Professional", notes: "Introduced me to the local founders group.", createdAt: "2026-08-12", activities: [{ type: "outreach", date: "2026-10-05", note: "Shared a community update" }], custom: {} },
    { id: "c6", name: "Elliot Chen", email: "elliot.chen@email.com", company: "—", role: "Teacher", relationship: "Family", notes: "Cousin. Send the photos from last weekend.", createdAt: "2026-09-11", activities: [{ type: "response", date: "2026-09-15", note: "Texted about the family dinner" }], custom: {} },
    { id: "c7", name: "Sofia Bennett", email: "sofia@brightpath.org", company: "Brightpath", role: "Nonprofit director", relationship: "Professional", notes: "Met through Maya. Send the fundraiser link when it is ready.", createdAt: "2026-08-30", activities: [], custom: {} }
  ]
};

let hasSavedLocalData = false;
let state = loadState();
let localImportCandidate = hasSavedLocalData ? structuredClone(state) : null;
let activeFilter = "all";
let activeContactId = null;
let toastTimer;
let supabaseClient = null;
let currentUser = null;
let openingUserId = null;
let remoteSnapshot = null;
let remoteSaveQueue = Promise.resolve();
let preparingRemoteState = false;
const colors = [
  ["#f5e9dd", "#866c56"], ["#e6eef1", "#617b88"], ["#eee8f5", "#806d96"],
  ["#e9efe5", "#718269"], ["#f4e8e8", "#976e70"], ["#e9edf7", "#697b9a"]
];
const activityLabels = { outreach: "Outreach", response: "Response", call: "Call", connection: "Connection" };
const emailTemplates = {
  new: {
    title: "A thoughtful follow-up",
    subject: name => name ? `Lovely meeting you, ${name}` : "Lovely meeting you",
    greeting: "Hi",
    signoff: "Warmly,\n[Your name]",
    mark: "♥",
    markClass: "suit-heart",
    banks: [
      { id: "opening", title: "Open the conversation", options: [
        ["meeting", "I really enjoyed meeting you at [place or event]. I’m glad we had a chance to talk."],
        ["introduction", "Thanks for making time to chat recently. I’ve been thinking about what you shared."],
        ["introduced", "It was a pleasure being introduced by [person]. I’m glad our paths crossed."]
      ] },
      { id: "personal", title: "Make it personal", options: [
        ["perspective", "Your perspective on [topic] stuck with me, especially [specific detail]."],
        ["learn", "I’d love to hear more about [their project or interest] when you have a moment."],
        ["resource", "Here’s the [resource or link] I mentioned—I thought it might be useful."]
      ] },
      { id: "next-step", title: "Leave a next step", options: [
        ["call", "Would you be open to a short call sometime in the next couple of weeks?"],
        ["offer", "If it’s helpful, I’d be glad to [offer or next step]. No pressure either way."],
        ["goodbye", "Either way, I hope the rest of your week is off to a good start."]
      ] }
    ]
  },
  warm: {
    title: "A little hello",
    subject: name => `Thinking of you${name ? `, ${name}` : ""}`,
    greeting: "Hi",
    signoff: "Take care,\n[Your name]",
    mark: "♦",
    markClass: "suit-diamond",
    banks: [
      { id: "opening", title: "Start with a hello", options: [
        ["conversation", "Something reminded me of our conversation about [topic], so I thought I’d say hello."],
        ["check-in", "How have things been going with [project or life update]?"],
        ["resource", "I came across [article, event, or resource] and thought you might enjoy it."]
      ] },
      { id: "personal", title: "Pick up their thread", options: [
        ["follow-up", "How did [thing they mentioned] turn out? I’d love to hear."],
        ["celebrate", "I saw your update about [good news]—congratulations! That’s wonderful."],
        ["memory", "I was thinking about [shared memory or moment] the other day. It still makes me smile."]
      ] },
      { id: "close", title: "Close warmly", options: [
        ["coffee", "Would you be up for catching up over coffee or a quick call sometime soon?"],
        ["no-ask", "No ask today—I just wanted to see how you’re doing."],
        ["open", "Whenever you have a moment, I’d love to hear what’s new with you."]
      ] }
    ]
  }
};
let activeEmailTemplate = "new";
const emailSelections = Object.fromEntries(Object.entries(emailTemplates).map(([key, template]) => [
  key,
  Object.fromEntries(template.banks.map(bank => [bank.id, bank.options[0][0]]))
]));

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.contacts)) {
      hasSavedLocalData = true;
      return { ...initialState, ...saved };
    }
  } catch (error) {
    console.warn("Warmly could not read saved CRM data; using the starter circle.", error);
  }
  return structuredClone(initialState);
}

function saveState() {
  if (supabaseClient && currentUser) ensureRemoteIds(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Warmly could not save CRM data.", error);
    showToast("Couldn’t save your changes. Check browser storage.");
  }
  if (!supabaseClient || !currentUser || preparingRemoteState) return;
  const snapshot = structuredClone(state);
  remoteSaveQueue = remoteSaveQueue.then(() => persistRemoteState(snapshot)).catch(error => {
    console.error("Warmly could not sync changes to Supabase.", error);
    showToast("Changes are saved on this device but didn’t sync. Check your connection.");
  });
}

function isLocalPreview() {
  return ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
}

function setAuthStatus(message, isError = false) {
  const status = document.getElementById("auth-status");
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function showAuthGate(message = "") {
  document.getElementById("app-shell").classList.add("hidden");
  document.getElementById("auth-gate").classList.remove("hidden");
  document.getElementById("sign-out").classList.add("hidden");
  setAuthStatus(message, Boolean(message));
}

function showAppShell() {
  document.getElementById("auth-gate").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("hidden");
}

async function initializeBackend() {
  let configResponse;
  try {
    configResponse = await fetch("/api/config", { cache: "no-store" });
  } catch (error) {
    if (isLocalPreview()) {
      console.info("Warmly is running in local demo mode.");
      showAppShell();
      return;
    }
    console.error("Warmly could not load its backend configuration.", error);
    showAuthGate("Warmly couldn’t reach its secure configuration. Please try again later.");
    return;
  }
  if (!configResponse.ok) {
    if (isLocalPreview() && configResponse.status === 404) {
      showAppShell();
      return;
    }
    showAuthGate("Warmly’s secure backend is not configured yet.");
    return;
  }
  let config;
  try {
    config = await configResponse.json();
  } catch (error) {
    console.error("Warmly received invalid backend configuration.", error);
    showAuthGate("Warmly’s secure backend configuration is invalid.");
    return;
  }
  if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase?.createClient) {
    showAuthGate("Warmly’s secure backend is not configured yet.");
    return;
  }
  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  document.getElementById("sign-out").classList.remove("hidden");
  document.getElementById("auth-form").addEventListener("submit", requestMagicLink);
  document.getElementById("sign-out").addEventListener("click", signOut);
  document.getElementById("import-local-data").addEventListener("click", importLocalData);
  document.getElementById("discard-local-data").addEventListener("click", discardLocalData);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session?.user) setTimeout(() => void openPrivateWorkspace(session.user), 0);
    else {
      currentUser = null;
      remoteSnapshot = null;
      showAuthGate();
    }
  });
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error("Warmly could not restore the sign-in session.", error);
    showAuthGate("Couldn’t restore your session. Sign in again.");
    return;
  }
  if (data.session?.user) await openPrivateWorkspace(data.session.user);
  else showAuthGate();
}

async function requestMagicLink(event) {
  event.preventDefault();
  const email = document.getElementById("auth-email").value.trim();
  const button = document.getElementById("auth-submit");
  button.disabled = true;
  setAuthStatus("Sending your private sign-in link…");
  try {
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin, shouldCreateUser: false }
    });
    if (error) throw error;
    setAuthStatus("Check your inbox for a secure sign-in link.");
  } catch (error) {
    console.error("Warmly could not send a sign-in link.", error);
    setAuthStatus(error.message || "Couldn’t send a sign-in link. Please try again.", true);
  } finally {
    button.disabled = false;
  }
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error("Warmly could not sign out.", error);
    showToast("Couldn’t sign out. Please try again.");
  }
}

async function openPrivateWorkspace(user) {
  if (openingUserId === user.id || (currentUser?.id === user.id && remoteSnapshot)) return;
  openingUserId = user.id;
  currentUser = user;
  showAuthGate("Opening your private circle…");
  try {
    const owner = await supabaseClient.from("app_owner").select("user_id").maybeSingle();
    if (owner.error) throw owner.error;
    if (!owner.data || owner.data.user_id !== user.id) {
      await supabaseClient.auth.signOut();
      showAuthGate("This account isn’t invited to this private Warmly space.");
      return;
    }
    const [contactsResult, activitiesResult, fieldsResult, valuesResult] = await Promise.all([
      supabaseClient.from("contacts").select("*").order("name"),
      supabaseClient.from("activities").select("*").order("happened_on", { ascending: false }),
      supabaseClient.from("custom_fields").select("*").order("created_at"),
      supabaseClient.from("custom_values").select("*")
    ]);
    for (const result of [contactsResult, activitiesResult, fieldsResult, valuesResult]) {
      if (result.error) throw result.error;
    }
    remoteSnapshot = {
      contacts: contactsResult.data,
      activities: activitiesResult.data,
      customFields: fieldsResult.data,
      customValues: valuesResult.data
    };
    if (!contactsResult.data.length) {
      state = { contacts: [], customFields: [] };
      if (localImportCandidate?.contacts?.length) {
        document.getElementById("import-description").textContent =
          `Import ${localImportCandidate.contacts.length} saved contacts and their logged moments, or start with an empty circle.`;
        document.getElementById("import-notice").classList.remove("hidden");
      }
    } else {
      state = hydrateRemoteState(remoteSnapshot);
      document.getElementById("import-notice").classList.add("hidden");
      localImportCandidate = null;
      saveLocalState();
    }
    showAppShell();
    render();
  } catch (error) {
    console.error("Warmly could not open the private workspace.", error);
    currentUser = null;
    remoteSnapshot = null;
    await supabaseClient.auth.signOut();
    showAuthGate(error.message?.includes("app_owner")
      ? "Warmly’s private database isn’t set up yet."
      : "Couldn’t open your private space. Please try again or check the setup.");
  } finally {
    openingUserId = null;
  }
}

function hydrateRemoteState(snapshot) {
  const contacts = snapshot.contacts.map(row => ({ ...row, createdAt: row.created_on, activities: [], custom: {} }));
  const contactById = new Map(contacts.map(contact => [contact.id, contact]));
  for (const row of snapshot.activities) {
    const contact = contactById.get(row.contact_id);
    if (contact) contact.activities.push({ id: row.id, type: row.type, date: row.happened_on, note: row.note || "" });
  }
  const fields = snapshot.customFields.map(row => ({ id: row.id, name: row.name, type: row.value_type }));
  const fieldById = new Map(fields.map(field => [field.id, field]));
  for (const row of snapshot.customValues) {
    const contact = contactById.get(row.contact_id);
    const field = fieldById.get(row.field_id);
    if (contact && field) contact.custom[field.id] = field.type === "date" ? row.value_date : row.value_text;
  }
  return { contacts, customFields: fields };
}

function saveLocalState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Warmly could not save the local data cache.", error);
    showToast("Your changes synced, but the local cache couldn’t be updated.");
  }
}

function ensureRemoteIds(snapshot) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  for (const contact of snapshot.contacts) {
    if (!uuidPattern.test(contact.id)) contact.id = crypto.randomUUID();
    for (const activity of contact.activities || []) {
      if (!uuidPattern.test(activity.id || "")) activity.id = crypto.randomUUID();
    }
  }
  for (const field of snapshot.customFields) {
    if (!uuidPattern.test(field.id)) field.id = crypto.randomUUID();
  }
}

async function persistRemoteState(snapshot) {
  if (!currentUser) return;
  ensureRemoteIds(snapshot);
  const contacts = snapshot.contacts.map(contact => ({
    id: contact.id, name: contact.name, email: contact.email || "", company: contact.company || "—",
    role: contact.role || "", relationship: contact.relationship || "Connection",
    notes: contact.notes || "", created_on: contact.createdAt || dateOnly()
  }));
  const fields = snapshot.customFields.map(field => ({
    id: field.id, name: field.name, value_type: field.type === "date" ? "date" : "text"
  }));
  const activities = snapshot.contacts.flatMap(contact => (contact.activities || []).map(activity => ({
    id: activity.id, contact_id: contact.id, type: activity.type,
    happened_on: activity.date || dateOnly(), note: activity.note || ""
  })));
  const customValues = snapshot.contacts.flatMap(contact => snapshot.customFields.flatMap(field => {
    const value = contact.custom?.[field.id];
    if (value === undefined || value === null || value === "") return [];
    return [{
      contact_id: contact.id, field_id: field.id,
      value_text: field.type === "date" ? null : String(value),
      value_date: field.type === "date" ? value : null
    }];
  }));
  const upsert = async (table, rows, conflict) => {
    if (!rows.length) return;
    const { error } = await supabaseClient.from(table).upsert(rows, { onConflict: conflict });
    if (error) throw error;
  };
  await upsert("contacts", contacts, "id");
  await upsert("custom_fields", fields, "id");
  await upsert("activities", activities, "id");
  await upsert("custom_values", customValues, "contact_id,field_id");

  const deleteMissing = async (table, oldRows, currentIds, idColumn = "id") => {
    const keep = new Set(currentIds);
    const obsolete = oldRows.map(row => row[idColumn]).filter(id => !keep.has(id));
    if (!obsolete.length) return;
    const { error } = await supabaseClient.from(table).delete().in(idColumn, obsolete);
    if (error) throw error;
  };
  const currentValueKeys = new Set(customValues.map(row => `${row.contact_id}:${row.field_id}`));
  for (const row of remoteSnapshot?.customValues || []) {
    if (currentValueKeys.has(`${row.contact_id}:${row.field_id}`)) continue;
    const { error } = await supabaseClient.from("custom_values").delete()
      .eq("contact_id", row.contact_id).eq("field_id", row.field_id);
    if (error) throw error;
  }
  await deleteMissing("activities", remoteSnapshot?.activities || [], activities.map(row => row.id));
  await deleteMissing("contacts", remoteSnapshot?.contacts || [], contacts.map(row => row.id));
  await deleteMissing("custom_fields", remoteSnapshot?.customFields || [], fields.map(row => row.id));
  remoteSnapshot = { contacts, activities, customFields: fields, customValues };
  saveLocalState();
}

async function importLocalData() {
  if (!localImportCandidate?.contacts?.length) return;
  const button = document.getElementById("import-local-data");
  button.disabled = true;
  try {
    const imported = structuredClone(localImportCandidate);
    const contacts = [...(imported.contacts || [])];
    const seen = new Set(contacts.map(contact => contact.id));
    for (const contact of state.contacts) {
      if (!seen.has(contact.id)) contacts.push(contact);
    }
    const customFields = [...(imported.customFields || [])];
    const fieldIds = new Set(customFields.map(field => field.id));
    for (const field of state.customFields) {
      if (!fieldIds.has(field.id)) customFields.push(field);
    }
    state = { contacts, customFields };
    await persistRemoteState(state);
    localImportCandidate = null;
    document.getElementById("import-notice").classList.add("hidden");
    render();
    showToast("Your saved circle has been imported");
  } catch (error) {
    console.error("Warmly could not import local data.", error);
    showToast("Import didn’t finish. Your local copy is still safe; try again.");
  } finally {
    button.disabled = false;
  }
}

function discardLocalData() {
  localImportCandidate = null;
  document.getElementById("import-notice").classList.add("hidden");
  saveState();
  showToast("Starting with an empty circle");
}

function dateOnly(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysBetween(first, second = dateOnly()) {
  if (!first) return Infinity;
  return Math.floor((new Date(`${second}T12:00:00`) - new Date(`${first}T12:00:00`)) / 86400000);
}

function latestActivity(contact) {
  return [...(contact.activities || [])].sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}

function warmthFor(contact) {
  const latest = latestActivity(contact);
  if (!latest) return { state: "new", label: "Just added", days: Infinity };
  const days = daysBetween(latest.date);
  if (days <= 7) return { state: "warm", label: days <= 2 ? "Glowing" : "Warm", days };
  if (days <= 30) return { state: "cool", label: "Cooling", days };
  return { state: "cold", label: "Cold", days };
}

function prettyDate(date) {
  if (!date) return "Not yet";
  const day = daysBetween(date);
  if (day === 0) return "Today";
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day} days ago`;
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
}

function avatarStyle(contact) {
  const [background, color] = colors[contact.name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length];
  return `background:${background};color:${color}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function render() {
  document.getElementById("nav-contact-count").textContent = state.contacts.length;
  document.getElementById("filter-all-count").textContent = state.contacts.length;
  renderStats();
  renderDashboardContacts();
  renderContacts();
  renderCharts();
  renderScriptContacts();
}

function renderStats() {
  const warmthCounts = state.contacts.reduce((counts, contact) => {
    counts[warmthFor(contact).state] = (counts[warmthFor(contact).state] || 0) + 1;
    return counts;
  }, {});
  const month = dateOnly().slice(0, 7);
  const activities = state.contacts.flatMap(contact => contact.activities || []);
  const monthActivities = activities.filter(activity => activity.date.startsWith(month));
  const warmCount = warmthCounts.warm || 0;
  document.getElementById("stat-total").textContent = state.contacts.length;
  document.getElementById("stat-warm").textContent = warmCount;
  document.getElementById("warm-percent").textContent = state.contacts.length ? `${Math.round(warmCount / state.contacts.length * 100)}% of circle` : "—";
  document.getElementById("stat-moments").textContent = monthActivities.length;
  document.getElementById("stat-cold").textContent = warmthCounts.cold || 0;
}

function renderDashboardContacts() {
  const target = document.getElementById("dashboard-contacts");
  const empty = document.getElementById("dashboard-empty");
  if (!state.contacts.length) {
    target.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  target.classList.remove("hidden");
  empty.classList.add("hidden");
  const prioritized = [...state.contacts].sort((a, b) => {
    const score = { cold: 0, cool: 1, new: 2, warm: 3 };
    const warmthDiff = score[warmthFor(a).state] - score[warmthFor(b).state];
    if (warmthDiff) return warmthDiff;
    return (latestActivity(b)?.date || b.createdAt).localeCompare(latestActivity(a)?.date || a.createdAt);
  }).slice(0, 5);
  target.innerHTML = prioritized.map(contactRow).join("");
}

function contactRow(contact) {
  const activity = latestActivity(contact);
  const warmth = warmthFor(contact);
  return `<div class="contact-row" data-contact="${escapeHtml(contact.id)}" tabindex="0" role="button" aria-label="View ${escapeHtml(contact.name)}">
    <div class="contact-person"><span class="contact-avatar" style="${avatarStyle(contact)}">${escapeHtml(initials(contact.name))}</span><span class="person-copy"><strong>${escapeHtml(contact.name)}</strong><small>${escapeHtml(contact.role || contact.company || "In your circle")}</small></span></div>
    <span class="row-relationship">${escapeHtml(contact.relationship || "Connection")}</span>
    <span class="row-date">${activity ? prettyDate(activity.date) : "Just added"}<small>${activity ? escapeHtml(activity.note || activityLabels[activity.type]) : "No moments yet"}</small></span>
    <span class="warmth ${warmth.state}"><i class="warmth-dot"></i>${warmth.label}</span>
    <button class="row-more" aria-label="More about ${escapeHtml(contact.name)}">···</button>
  </div>`;
}

function renderContacts() {
  const query = document.getElementById("contact-search").value.trim().toLowerCase();
  const filtered = state.contacts.filter(contact => {
    const warmth = warmthFor(contact).state;
    const matchesFilter = activeFilter === "all" || warmth === activeFilter;
    const haystack = [contact.name, contact.email, contact.company, contact.role, contact.relationship, ...Object.values(contact.custom || {})].join(" ").toLowerCase();
    return matchesFilter && haystack.includes(query);
  }).sort((a, b) => a.name.localeCompare(b.name));
  document.getElementById("contacts-table").innerHTML = filtered.map(contactRow).join("");
  document.getElementById("contacts-empty").classList.toggle("hidden", filtered.length > 0);
  document.getElementById("contacts-count-label").textContent = `${filtered.length} ${filtered.length === 1 ? "person" : "people"}`;
}

function monthStart(offset = 0) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - offset, 1);
}

function renderCharts() {
  const range = Number(document.getElementById("trend-range").value);
  const activities = state.contacts.flatMap(contact => contact.activities || []);
  const months = Array.from({ length: range }, (_, index) => monthStart(range - index - 1));
  const values = months.map(date => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return activities.filter(activity => activity.date.startsWith(key)).length;
  });
  document.getElementById("chart-total").textContent = activities.length;
  document.getElementById("trend-chart").innerHTML = lineChart(months, values);
  const counts = {
    outreach: activities.filter(item => item.type === "outreach").length,
    response: activities.filter(item => item.type === "response").length,
    call: activities.filter(item => item.type === "call" || item.type === "connection").length
  };
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  document.getElementById("outcome-total").textContent = total;
  const max = Math.max(1, ...Object.values(counts));
  document.getElementById("outcome-bars").innerHTML = [
    ["outreach", "Outreach", counts.outreach, "bar-outreach"],
    ["response", "Replies", counts.response, "bar-response"],
    ["call", "Calls & meets", counts.call, "bar-call"]
  ].map(([key, label, count, className]) => `<div class="outcome-row"><span>${label}</span><div class="bar-track"><div class="bar-fill ${className}" style="width:${count / max * 100}%"></div></div><strong>${count}</strong></div>`).join("");
  document.getElementById("outcome-total").setAttribute("aria-label", `${total} logged activities`);
}

function lineChart(months, values) {
  const width = 620, height = 145, left = 25, right = 12, top = 14, bottom = 23;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const max = Math.max(3, ...values);
  const points = values.map((value, index) => ({
    x: left + (months.length === 1 ? plotWidth / 2 : index * plotWidth / (months.length - 1)),
    y: top + plotHeight - value / max * plotHeight
  }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const area = `${path} L${points[points.length - 1].x},${top + plotHeight} L${points[0].x},${top + plotHeight} Z`;
  const grid = [0, 1, 2].map(index => {
    const y = top + index * plotHeight / 2;
    return `<line class="chart-grid-line" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"></line><text class="chart-axis" x="0" y="${y + 3}">${Math.round(max * (1 - index / 2))}</text>`;
  }).join("");
  const labels = months.map((date, index) => `<text class="chart-axis" text-anchor="middle" x="${points[index].x}" y="${height - 3}">${date.toLocaleDateString(undefined, { month: "short" })}</text>`).join("");
  const dots = points.map((point, index) => `<circle class="chart-point" cx="${point.x}" cy="${point.y}" r="3"><title>${months[index].toLocaleDateString(undefined, { month: "long", year: "numeric" })}: ${values[index]} activities</title></circle>`).join("");
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#e6a16c" stop-opacity=".2"></stop><stop offset="100%" stop-color="#e6a16c" stop-opacity="0"></stop></linearGradient></defs>${grid}<path class="chart-area" d="${area}"></path><path class="chart-path" d="${path}"></path>${dots}${labels}</svg>`;
}

function switchView(view) {
  document.querySelectorAll(".view").forEach(element => element.classList.toggle("active", element.id === `${view}-view`));
  document.querySelectorAll(".nav-link").forEach(element => element.classList.toggle("active", element.dataset.view === view));
  document.getElementById("page-crumb").textContent = ({ dashboard: "Dashboard", contacts: "Contacts", emails: "Email scripts" })[view];
  document.getElementById("add-contact-top").classList.toggle("hidden", view !== "dashboard");
  if (view === "contacts") renderContacts();
  if (view === "emails") renderEmailScripts();
}

function renderScriptContacts() {
  const select = document.getElementById("script-contact");
  const selected = select.value;
  select.innerHTML = `<option value="">Choose a contact (optional)</option>${state.contacts
    .slice().sort((a, b) => a.name.localeCompare(b.name))
    .map(contact => `<option value="${escapeHtml(contact.id)}">${escapeHtml(contact.name)}${contact.email ? ` · ${escapeHtml(contact.email)}` : ""}</option>`).join("")}`;
  if (state.contacts.some(contact => contact.id === selected)) select.value = selected;
}

function selectedScriptContact() {
  return state.contacts.find(contact => contact.id === document.getElementById("script-contact").value);
}

function renderEmailScripts() {
  const template = emailTemplates[activeEmailTemplate];
  document.querySelectorAll(".email-template-tab").forEach(button => {
    const active = button.dataset.template === activeEmailTemplate;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.getElementById("compose-title").textContent = template.title;
  const mark = document.getElementById("compose-mark");
  mark.textContent = template.mark;
  mark.className = `compose-mark ${template.markClass}`;
  document.getElementById("paragraph-banks").innerHTML = template.banks.map((bank, bankIndex) => `
    <section class="paragraph-bank" aria-labelledby="bank-title-${bank.id}">
      <div class="bank-title-row"><span class="bank-number">${String(bankIndex + 1).padStart(2, "0")}</span><h3 id="bank-title-${bank.id}">${escapeHtml(bank.title)}</h3><span class="bank-choice-label">CHOOSE ONE</span></div>
      <div class="bank-options">${bank.options.map(([id, text]) => {
        const selected = emailSelections[activeEmailTemplate][bank.id] === id;
        return `<button type="button" class="bank-option${selected ? " selected" : ""}" data-bank="${escapeHtml(bank.id)}" data-option="${escapeHtml(id)}" aria-pressed="${selected}"><span class="bank-option-mark ${template.markClass}">${selected ? "✓" : template.mark}</span><span>${escapeHtml(text)}</span></button>`;
      }).join("")}</div>
    </section>`).join("");
  updateEmailPreview();
}

function updateEmailPreview() {
  const template = emailTemplates[activeEmailTemplate];
  const contact = selectedScriptContact();
  const firstName = contact?.name.trim().split(/\s+/)[0] || "[First name]";
  const paragraphs = template.banks.map(bank => {
    const option = bank.options.find(([id]) => id === emailSelections[activeEmailTemplate][bank.id]);
    return option?.[1];
  }).filter(Boolean);
  document.getElementById("email-subject").value = template.subject(contact?.name.trim().split(/\s+/)[0]);
  document.getElementById("email-body").value = `${template.greeting} ${firstName},\n\n${paragraphs.join("\n\n")}\n\n${template.signoff}`;
}

async function copyEmail() {
  const subject = document.getElementById("email-subject").value.trim();
  const body = document.getElementById("email-body").value.trim();
  const email = `${subject ? `Subject: ${subject}\n\n` : ""}${body}`;
  try {
    await navigator.clipboard.writeText(email);
    showToast("Email copied—ready to paste into your email client");
  } catch (error) {
    console.error("Warmly could not copy the email to the clipboard.", error);
    showToast("Couldn’t copy automatically. Select the email text and copy it.");
  }
}

function showModal(title, kicker, content, onSubmit) {
  const backdrop = document.getElementById("modal-backdrop");
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-kicker").textContent = kicker;
  document.getElementById("modal-content").innerHTML = content;
  backdrop.classList.remove("hidden");
  const form = document.querySelector("#modal-content form");
  if (form && onSubmit) form.addEventListener("submit", event => { event.preventDefault(); onSubmit(new FormData(form)); });
  const focusable = document.querySelector("#modal-content input, #modal-content select, #modal-content button");
  if (focusable) focusable.focus();
}

function closeModal() {
  document.getElementById("modal-backdrop").classList.add("hidden");
}

function customFieldMarkup(contact = null) {
  return state.customFields.map(field => `<div class="field"><label for="custom-${escapeHtml(field.id)}">${escapeHtml(field.name)}</label><input id="custom-${escapeHtml(field.id)}" name="custom:${escapeHtml(field.id)}" type="${field.type === "date" ? "date" : "text"}" value="${escapeHtml(contact?.custom?.[field.id] || "")}" placeholder="${escapeHtml(field.name)}"></div>`).join("");
}

function openContactForm(contact = null) {
  const isEdit = Boolean(contact);
  const customMarkup = customFieldMarkup(contact);
  const content = `<form><div class="form-grid">
    <div class="field"><label for="name">Name *</label><input id="name" name="name" required value="${escapeHtml(contact?.name || "")}" placeholder="e.g. Alex Morgan"></div>
    <div class="field"><label for="relationship">Relationship</label><select id="relationship" name="relationship">${["Friend", "Professional", "Former colleague", "Family", "Mentor", "Other"].map(value => `<option ${contact?.relationship === value ? "selected" : ""}>${value}</option>`).join("")}</select></div>
    <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" value="${escapeHtml(contact?.email || "")}" placeholder="alex@example.com"></div>
    <div class="field"><label for="company">Company / organization</label><input id="company" name="company" value="${escapeHtml(contact?.company === "—" ? "" : contact?.company || "")}" placeholder="Where they work"></div>
    <div class="field"><label for="role">Role / title</label><input id="role" name="role" value="${escapeHtml(contact?.role || "")}" placeholder="What they do"></div>
    <div class="field"><label for="first-date">First connection</label><input id="first-date" name="firstDate" type="date" value="${escapeHtml(contact?.createdAt || dateOnly())}"></div>
    ${customMarkup}
    <div class="field full"><label for="notes">A few things to remember</label><textarea id="notes" name="notes" placeholder="What matters to them? What would you like to ask next time?">${escapeHtml(contact?.notes || "")}</textarea></div>
  </div><div class="form-actions">${isEdit ? `<button class="danger-button" type="button" id="delete-contact">Remove contact</button>` : "<span></span>"}<div><button class="button secondary-button close-form" type="button">Cancel</button> <button class="button button-primary" type="submit">${isEdit ? "Save changes" : "Add to my circle"}</button></div></div></form>`;
  showModal(isEdit ? "A little update" : "Add someone to your circle", isEdit ? "KEEP THEIR DETAILS CLOSE" : "A NEW CONNECTION", content, data => {
    const custom = {};
    for (const field of state.customFields) custom[field.id] = String(data.get(`custom:${field.id}`) || "").trim();
    const values = {
      name: String(data.get("name")).trim(),
      relationship: data.get("relationship"),
      email: String(data.get("email") || "").trim(),
      company: String(data.get("company") || "").trim() || "—",
      role: String(data.get("role") || "").trim(),
      createdAt: data.get("firstDate") || dateOnly(),
      notes: String(data.get("notes") || "").trim(),
      custom
    };
    if (isEdit) Object.assign(contact, values);
    else state.contacts.push({ id: crypto.randomUUID(), ...values, activities: [] });
    saveState(); closeModal(); render(); showToast(isEdit ? "Contact details saved" : `${values.name} is in your circle`);
  });
  document.querySelector(".close-form").addEventListener("click", closeModal);
  if (isEdit) document.getElementById("delete-contact").addEventListener("click", () => confirmDelete(contact));
}

function openActivity(contact) {
  const content = `<div class="contact-detail-head"><span class="contact-avatar" style="${avatarStyle(contact)}">${escapeHtml(initials(contact.name))}</span><div><h3>${escapeHtml(contact.name)}</h3><p>What kind of moment did you share?</p></div></div>
    <form><div class="activity-options">
    ${[["outreach", "♦", "Reached out", "suit-diamond"], ["response", "♥", "They replied", "suit-heart"], ["call", "♣", "Had a call", "suit-club"], ["connection", "♠", "Met / connected", "suit-spade"]].map(([type, icon, label, suit]) => `<label class="activity-choice"><input type="radio" name="type" value="${type}" ${type === "outreach" ? "checked" : ""} hidden><span class="${suit}">${icon}</span>${label}</label>`).join("")}
    </div><div class="form-grid"><div class="field"><label for="activity-date">When</label><input type="date" id="activity-date" name="date" value="${dateOnly()}"></div><div class="field"><label for="activity-note">A little note</label><input id="activity-note" name="note" placeholder="Coffee, a text, a hello..."></div></div><div class="form-actions"><button class="button secondary-button close-form" type="button">Cancel</button><button class="button button-primary" type="submit">Save this moment</button></div></form>`;
  showModal("Save a little moment", "KEEP THE CONNECTION GOING", content, data => {
    contact.activities ||= [];
    contact.activities.push({ type: data.get("type"), date: data.get("date") || dateOnly(), note: String(data.get("note") || "").trim() });
    saveState(); closeModal(); render(); showToast("A moment worth remembering, saved");
  });
  document.querySelectorAll(".activity-choice").forEach(label => label.addEventListener("click", () => {
    document.querySelectorAll(".activity-choice").forEach(item => item.style.borderColor = "");
    label.style.borderColor = "#9bb29f";
  }));
  document.querySelector(".close-form").addEventListener("click", closeModal);
}

function openContactDetail(contact) {
  activeContactId = contact.id;
  const warmth = warmthFor(contact);
  const activity = latestActivity(contact);
  const customDetails = state.customFields.map(field => contact.custom?.[field.id] ? `<div class="detail-item"><small>${escapeHtml(field.name)}</small><strong>${escapeHtml(contact.custom[field.id])}</strong></div>` : "").join("");
  const history = [...(contact.activities || [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const content = `<div class="contact-detail-head"><span class="contact-avatar" style="${avatarStyle(contact)}">${escapeHtml(initials(contact.name))}</span><div><h3>${escapeHtml(contact.name)}</h3><p>${escapeHtml([contact.role, contact.company !== "—" ? contact.company : ""].filter(Boolean).join(" · ") || "In your circle")}</p></div><span class="warmth ${warmth.state}" style="margin-left:auto"><i class="warmth-dot"></i>${warmth.label}</span></div>
    <div class="detail-grid"><div class="detail-item"><small>Relationship</small><strong>${escapeHtml(contact.relationship || "Connection")}</strong></div><div class="detail-item"><small>Email</small><strong>${escapeHtml(contact.email || "Not added")}</strong></div><div class="detail-item"><small>First connected</small><strong>${escapeHtml(prettyDate(contact.createdAt))}</strong></div><div class="detail-item"><small>Last moment</small><strong>${escapeHtml(activity ? prettyDate(activity.date) : "Not yet")}</strong></div>${customDetails}</div>
    ${contact.notes ? `<div class="detail-notes">${escapeHtml(contact.notes)}</div>` : ""}
    <div class="form-actions" style="margin:0;padding:0;border:0"><button class="button secondary-button" id="edit-contact">Edit details</button><button class="button button-primary" id="log-activity">＋ Log a moment</button></div>
    <div class="history-title">RECENT MOMENTS</div>${history.length ? history.map(item => `<div class="history-row"><i></i><div>${escapeHtml(item.note || activityLabels[item.type] || "Connected")}<small>${escapeHtml(activityLabels[item.type] || "Moment")} · ${escapeHtml(prettyDate(item.date))}</small></div></div>`).join("") : `<p class="modal-subtitle" style="margin:0">No moments yet. A quick hello is a good place to start.</p>`}`;
  showModal("A closer look", "YOUR CONNECTION", content);
  document.getElementById("edit-contact").addEventListener("click", () => openContactForm(contact));
  document.getElementById("log-activity").addEventListener("click", () => openActivity(contact));
}

function confirmDelete(contact) {
  const content = `<p class="modal-subtitle" style="margin:0 0 18px">Remove <strong>${escapeHtml(contact.name)}</strong> and their saved moments from your circle? This can’t be undone.</p><div class="form-actions"><button class="button secondary-button close-form" type="button">Keep contact</button><button class="button" style="background:#fff1ed;color:#b66555" id="confirm-delete">Remove contact</button></div>`;
  showModal("Remove this connection?", "A QUICK CHECK", content);
  document.querySelector(".close-form").addEventListener("click", () => openContactForm(contact));
  document.getElementById("confirm-delete").addEventListener("click", () => {
    state.contacts = state.contacts.filter(item => item.id !== contact.id);
    saveState(); closeModal(); render(); showToast(`${contact.name} was removed`);
  });
}

function openFieldManager() {
  const fields = state.customFields.map(field => `<div class="field-manage-row"><span>${escapeHtml(field.name)} <small style="color:#a5aea7"> · ${escapeHtml(field.type)}</small></span><button data-remove-field="${escapeHtml(field.id)}">Remove</button></div>`).join("");
  const content = `<p class="modal-subtitle">Add details that make sense for your relationships. They’ll appear when you add or edit a contact.</p><div id="custom-field-list">${fields || `<p class="modal-subtitle" style="margin:0">No custom fields yet.</p>`}</div><form id="custom-field-form" class="custom-field-add"><input name="name" required maxlength="32" placeholder="e.g. Birthday"><select name="type"><option value="text">Short text</option><option value="date">Date</option></select><button class="button button-primary" type="submit">Add field</button></form><div class="form-actions"><span></span><button class="button secondary-button close-form" type="button">Done</button></div>`;
  showModal("Make it your own", "CUSTOM CONTACT FIELDS", content);
  document.querySelectorAll("[data-remove-field]").forEach(button => button.addEventListener("click", () => {
    const fieldId = button.dataset.removeField;
    state.customFields = state.customFields.filter(field => field.id !== fieldId);
    state.contacts.forEach(contact => { delete contact.custom?.[fieldId]; });
    saveState(); openFieldManager();
  }));
  document.getElementById("custom-field-form").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name")).trim();
    if (!name || state.customFields.some(field => field.name.toLowerCase() === name.toLowerCase())) {
      showToast(name ? "That field already exists" : "Give your field a name");
      return;
    }
    state.customFields.push({ id: crypto.randomUUID(), name, type: data.get("type") });
    saveState(); openFieldManager(); showToast(`${name} field added`);
  });
  document.querySelector(".close-form").addEventListener("click", closeModal);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 2800);
}

document.querySelectorAll(".nav-link").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
document.querySelectorAll(".email-template-tab").forEach(button => button.addEventListener("click", () => {
  activeEmailTemplate = button.dataset.template;
  renderEmailScripts();
}));
document.getElementById("paragraph-banks").addEventListener("click", event => {
  const option = event.target.closest(".bank-option");
  if (!option) return;
  emailSelections[activeEmailTemplate][option.dataset.bank] = option.dataset.option;
  renderEmailScripts();
});
document.getElementById("script-contact").addEventListener("change", updateEmailPreview);
document.getElementById("copy-email").addEventListener("click", copyEmail);
document.getElementById("add-contact-top").addEventListener("click", () => openContactForm());
document.getElementById("add-contact-page").addEventListener("click", () => openContactForm());
document.getElementById("empty-add-contact").addEventListener("click", () => openContactForm());
document.getElementById("view-all-contacts").addEventListener("click", () => switchView("contacts"));
document.getElementById("manage-fields").addEventListener("click", openFieldManager);
document.getElementById("contact-search").addEventListener("input", renderContacts);
document.getElementById("trend-range").addEventListener("change", renderCharts);
document.querySelectorAll(".filter-pill").forEach(button => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll(".filter-pill").forEach(pill => pill.classList.toggle("active", pill === button));
  renderContacts();
}));
document.getElementById("see-cold").addEventListener("click", () => {
  switchView("contacts");
  activeFilter = "cold";
  document.querySelectorAll(".filter-pill").forEach(pill => pill.classList.toggle("active", pill.dataset.filter === "cold"));
  renderContacts();
});
document.getElementById("modal-backdrop").addEventListener("click", event => { if (event.target.id === "modal-backdrop") closeModal(); });
document.querySelector(".close-modal").addEventListener("click", closeModal);
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeModal();
  const row = event.target.closest?.(".contact-row");
  if (row && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    const contact = state.contacts.find(item => item.id === row.dataset.contact);
    if (contact) openContactDetail(contact);
  }
});
document.addEventListener("click", event => {
  const row = event.target.closest(".contact-row");
  if (!row) return;
  const contact = state.contacts.find(item => item.id === row.dataset.contact);
  if (contact) openContactDetail(contact);
});

document.getElementById("today-date").textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
document.querySelector(".eyebrow").innerHTML = `<span class="eyebrow-line"></span> ${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).toUpperCase()}`;
render();
initializeBackend();
