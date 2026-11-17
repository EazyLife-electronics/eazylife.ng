// School STEM management module for the EazyLife admin dashboard.
// All records are stored in admin-only Firestore collections.
import {
  collection, addDoc, getDocs, getDoc, setDoc, doc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initFirebase } from "../../js/firebase.mjs";

const { db } = initFirebase();
let initialized = false;
let pricing = {
  preparation: 0, facilitationPerSession: 0, instructorPerSession: 0,
  kitPerLearner: 0, consumablesPerLearner: 0, travelPerVisit: 0,
  equipment: 0, assessmentReporting: 0, contingencyPercent: 10,
  targetMarginPercent: 35, minimumMarginPercent: 15
};
let meetings = [];

const money = n => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Number(n) || 0);
const num = id => Math.max(0, Number(document.getElementById(id)?.value) || 0);
const val = id => document.getElementById(id)?.value?.trim() || "";
const esc = s => String(s ?? "").replace(/[&<>'"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[c]));
const checked = name => [...document.querySelectorAll('[name="' + name + '"]:checked')].map(x => x.value);

function modelFor(goals, frequency, duration, lab) {
  if (goals.includes("lab") || goals.includes("teacher") || frequency === "weekly") return "STEM Academy and Innovation Partnership";
  if (frequency === "termly" || duration === "term") return "Structured School STEM Programme";
  if (goals.includes("robotics") || goals.includes("projects")) return "Project-Based Training";
  return "STEM Experience";
}

function calculate() {
  const learners = num("ssLearners"), groups = Math.max(1, num("ssGroups"));
  const sessions = Math.max(1, num("ssSessions"));
  const visits = Math.max(1, num("ssVisits"));
  const instructors = Math.max(1, num("ssInstructors"));
  const preparation = pricing.preparation;
  const facilitation = pricing.facilitationPerSession * sessions * groups;
  const instructorCost = pricing.instructorPerSession * sessions * instructors;
  const kits = pricing.kitPerLearner * learners;
  const consumables = pricing.consumablesPerLearner * learners * Math.max(1, sessions);
  const travel = pricing.travelPerVisit * visits;
  const equipment = pricing.equipment;
  const reporting = pricing.assessmentReporting;
  const direct = preparation + facilitation + instructorCost + kits + consumables + travel + equipment + reporting;
  const contingency = direct * (pricing.contingencyPercent / 100);
  const total = direct + contingency;
  const target = pricing.targetMarginPercent / 100;
  const floor = pricing.minimumMarginPercent / 100;
  const preferred = target < 0.99 ? total / (1 - target) : total;
  const minimum = floor < 0.99 ? total / (1 - floor) : total;
  return { learners, groups, sessions, visits, instructors, preparation, facilitation, instructorCost, kits, consumables, travel, equipment, reporting, direct, contingency, total, preferred, minimum };
}

function renderEstimate() {
  const out = document.getElementById("ssEstimate");
  if (!out) return;
  const c = calculate();
  const configured = Object.entries(pricing).filter(([k,v]) => !["contingencyPercent","targetMarginPercent","minimumMarginPercent"].includes(k) && Number(v) > 0).length;
  out.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
      <div class="rounded-xl bg-slate-50 p-3"><p class="text-[10px] text-slate-500">Estimated delivery cost</p><p class="font-black text-sm">${money(c.total)}</p></div>
      <div class="rounded-xl bg-teal-50 p-3"><p class="text-[10px] text-teal-700">Preferred price</p><p class="font-black text-sm text-teal-800">${money(c.preferred)}</p></div>
      <div class="rounded-xl bg-amber-50 p-3"><p class="text-[10px] text-amber-700">Minimum price</p><p class="font-black text-sm text-amber-800">${money(c.minimum)}</p></div>
      <div class="rounded-xl bg-slate-50 p-3"><p class="text-[10px] text-slate-500">Configured cost items</p><p class="font-black text-sm">${configured}/8</p></div>
    </div>
    <div class="rounded-xl border border-slate-200 p-3 text-xs space-y-1">
      <div class="flex justify-between"><span>Preparation</span><b>${money(c.preparation)}</b></div>
      <div class="flex justify-between"><span>Facilitation</span><b>${money(c.facilitation)}</b></div>
      <div class="flex justify-between"><span>Additional instructors</span><b>${money(c.instructorCost)}</b></div>
      <div class="flex justify-between"><span>Learner kits</span><b>${money(c.kits)}</b></div>
      <div class="flex justify-between"><span>Consumables</span><b>${money(c.consumables)}</b></div>
      <div class="flex justify-between"><span>Travel and logistics</span><b>${money(c.travel)}</b></div>
      <div class="flex justify-between"><span>Equipment</span><b>${money(c.equipment)}</b></div>
      <div class="flex justify-between"><span>Assessment and reporting</span><b>${money(c.reporting)}</b></div>
      <div class="flex justify-between border-t pt-1"><span>Contingency (${pricing.contingencyPercent}%)</span><b>${money(c.contingency)}</b></div>
      <div class="flex justify-between border-t pt-2 font-black"><span>Total estimated cost</span><b>${money(c.total)}</b></div>
    </div>
    <p class="text-[10px] text-slate-500 mt-2">Planning estimate only. Confirm actual scope, staffing, travel, equipment ownership and tax treatment before issuing a binding quotation.</p>`;
  if (configured < 8) {
    const warning = document.createElement("p");
    warning.className = "mt-2 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800 font-semibold";
    warning.textContent = "Rate card incomplete. Configure all applicable cost items before relying on this estimate. A zero value is treated as unconfigured, not as a confirmed free service.";
    out.append(warning);
  }
  const offer = num("ssOffer");
  const result = document.getElementById("ssNegotiationResult");
  if (result) {
    if (!offer) result.innerHTML = "Enter a school's offer to assess it against your configured floor.";
    else if (offer >= c.preferred) result.innerHTML = '<span class="text-teal-700 font-bold">Within preferred pricing.</span> The current scope is financially supported by the configured target margin.';
    else if (offer >= c.minimum) result.innerHTML = '<span class="text-amber-700 font-bold">Negotiable with care.</span> This is below your preferred price but above your configured minimum. Confirm the scope before accepting.';
    else result.innerHTML = '<span class="text-red-700 font-bold">Below your minimum.</span> Do not accept the same scope at this offer. Reduce sessions, class coverage, kit contents, equipment provision or reporting, then recalculate.';
  }
}

function renderMeetings() {
  const el = document.getElementById("ssMeetingList");
  if (!el) return;
  el.innerHTML = meetings.length ? meetings.map(m => `
    <article class="border border-slate-200 rounded-xl p-3">
      <div class="flex items-start justify-between gap-2"><div><p class="font-bold text-sm">${esc(m.schoolName || "Unnamed school")}</p><p class="text-[11px] text-slate-500">${esc(m.location || "")} · ${esc(m.meetingDate || "Date not set")}</p></div><span class="text-[10px] rounded-full bg-teal-50 text-teal-800 px-2 py-1">${esc(m.model || "Unassigned")}</span></div>
      <p class="text-xs text-slate-600 mt-2">${esc(m.conclusion || m.notes || "No meeting notes yet")}</p>
    </article>`).join("") : '<p class="text-xs text-slate-400">No school meetings saved yet.</p>';
}

function buildSchoolSummary() {
  const goals = checked("ssGoal");
  const model = modelFor(goals, val("ssFrequency"), val("ssDuration"), val("ssLab"));
  const school = val("ssSchool") || "School";
  const lines = [
    "EazyLife School STEM and Robotics Education Programme",
    "School: " + school,
    "Location: " + val("ssLocation"),
    "Meeting date: " + val("ssDate"),
    "Proposed engagement: " + model,
    "Priority areas: " + (goals.join(", ") || "To be confirmed"),
    "Learner group: " + val("ssClasses"),
    "Proposed learners: " + val("ssLearners"),
    "Suggested delivery: " + val("ssFrequency") + ", " + val("ssDuration"),
    "",
    "Proposed focus:",
    "Practical, age-appropriate STEM learning with guided activities, engineering projects and evidence of learner progress.",
    "Final activities, schedule, equipment, class size and investment will be confirmed after scope validation.",
    "",
    "Prepared by EazyLife Robotics and Electronics Solutions"
  ];
  return lines.join("\n");
}

async function saveMeeting() {
  const schoolName = val("ssSchool");
  if (!schoolName) { alert("Enter the school name first."); return; }
  const goals = checked("ssGoal");
  const model = modelFor(goals, val("ssFrequency"), val("ssDuration"), val("ssLab"));
  const c = calculate();
  const record = {
    schoolName, contact: val("ssContact"), phone: val("ssPhone"), email: val("ssEmail"),
    location: val("ssLocation"), schoolType: val("ssType"), curriculum: val("ssCurriculum"),
    meetingDate: val("ssDate"), goals, model, classes: val("ssClasses"),
    learners: c.learners, groups: c.groups, sessions: c.sessions, visits: c.visits,
    instructors: c.instructors, frequency: val("ssFrequency"), duration: val("ssDuration"),
    facilities: val("ssFacilities"), budgetPosition: val("ssBudget"), notes: val("ssNotes"),
    conclusion: val("ssConclusion"),
    internalEstimate: { deliveryCost: c.total, preferredPrice: c.preferred, minimumPrice: c.minimum },
    updatedAt: serverTimestamp()
  };
  await addDoc(collection(db, "schoolStemMeetings"), { ...record, createdAt: serverTimestamp() });
  alert("School meeting saved.");
  meetings.unshift(record);
  renderMeetings();
}

async function savePricing() {
  const fields = ["preparation","facilitationPerSession","instructorPerSession","kitPerLearner","consumablesPerLearner","travelPerVisit","equipment","assessmentReporting","contingencyPercent","targetMarginPercent","minimumMarginPercent"];
  fields.forEach(k => { pricing[k] = Math.max(0, Number(document.getElementById("rate_" + k)?.value) || 0); });
  await setDoc(doc(db, "schoolStemPricing", "default"), { ...pricing, updatedAt: serverTimestamp() });
  alert("Internal pricing configuration saved securely.");
  renderEstimate();
}

function renderPricingInputs() {
  const labels = {
    preparation:"Planning and preparation (per programme)",
    facilitationPerSession:"Lead facilitator (per session, per group)",
    instructorPerSession:"Additional instructor (per session)",
    kitPerLearner:"Project kit (per learner)",
    consumablesPerLearner:"Consumables (per learner, per session)",
    travelPerVisit:"Travel and logistics (per visit)",
    equipment:"Equipment / lab provision (programme total)",
    assessmentReporting:"Assessment and reporting (programme total)"
  };
  const fields = Object.entries(labels).map(([key,label]) => `
    <label class="block"><span class="text-[11px] font-semibold text-slate-600">${label}</span><input id="rate_${key}" type="number" min="0" inputmode="numeric" value="${pricing[key]}" class="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm"></label>`).join("");
  const pct = ["contingencyPercent","targetMarginPercent","minimumMarginPercent"].map(k => `
    <label class="block"><span class="text-[11px] font-semibold text-slate-600">${k === "contingencyPercent" ? "Contingency %" : k === "targetMarginPercent" ? "Target margin %" : "Minimum margin %"}</span><input id="rate_${k}" type="number" min="0" max="90" value="${pricing[k]}" class="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm"></label>`).join("");
  return fields + pct;
}

async function loadData() {
  try {
    const p = await getDoc(doc(db, "schoolStemPricing", "default"));
    if (p.exists()) pricing = { ...pricing, ...p.data() };
    const snap = await getDocs(query(collection(db, "schoolStemMeetings"), orderBy("createdAt", "desc")));
    meetings = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  } catch (err) {
    console.error("School STEM data could not be loaded:", err);
    const status = document.getElementById("ssStatus");
    if (status) status.textContent = "Could not load School STEM records. Check Firestore rules after deployment.";
  }
  const rateWrap = document.getElementById("ssRateInputs");
  if (rateWrap) {
    rateWrap.innerHTML = renderPricingInputs();
    rateWrap.querySelectorAll("input").forEach(input => input.addEventListener("input", () => {
      const key = input.id.replace("rate_", "");
      pricing[key] = Math.max(0, Number(input.value) || 0);
      renderEstimate();
    }));
  }
  renderMeetings();
  renderEstimate();
}

export function resetSchoolStem() {
  initialized = false;
  meetings = [];
  pricing = {
    preparation: 0, facilitationPerSession: 0, instructorPerSession: 0,
    kitPerLearner: 0, consumablesPerLearner: 0, travelPerVisit: 0,
    equipment: 0, assessmentReporting: 0, contingencyPercent: 10,
    targetMarginPercent: 35, minimumMarginPercent: 15
  };
  const host = document.getElementById("schoolStemContent");
  if (host) host.innerHTML = "";
  document.querySelector('[data-tab="school-stem"]')?.classList.add("hidden");
}

export function initSchoolStem() {
  if (initialized) return;
  initialized = true;
  document.querySelector('[data-tab="school-stem"]')?.classList.remove("hidden");
  const host = document.getElementById("schoolStemContent");
  if (!host) return;
  host.innerHTML = `
    <div class="space-y-4">
      <section class="rounded-2xl bg-slate-900 text-white p-5">
        <p class="text-[10px] uppercase tracking-widest text-teal-300 font-bold">EazyLife internal workspace</p>
        <h2 class="text-xl font-black mt-1">School STEM Management</h2>
        <p class="text-xs text-slate-300 mt-2">Prepare school meetings, recommend an engagement model and protect your pricing position.</p>
      </section>
      <p id="ssStatus" class="text-[11px] text-slate-500">Loading secure school records…</p>
      <section class="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <div><h3 class="font-black text-base">New school meeting</h3><p class="text-[11px] text-slate-500">Capture needs first. Confirm scope and delivery assumptions before quoting.</p></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="text-xs font-semibold">School name<input id="ssSchool" class="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="School name"></label>
          <label class="text-xs font-semibold">Contact person<input id="ssContact" class="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="Name and role"></label>
          <label class="text-xs font-semibold">Phone<input id="ssPhone" class="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="Phone number"></label>
          <label class="text-xs font-semibold">Email<input id="ssEmail" type="email" class="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="Email address"></label>
          <label class="text-xs font-semibold">Location<input id="ssLocation" class="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="Area / city"></label>
          <label class="text-xs font-semibold">Meeting date<input id="ssDate" type="date" class="mt-1 w-full rounded-lg border p-2.5 text-sm"></label>
          <label class="text-xs font-semibold">School type<select id="ssType" class="mt-1 w-full rounded-lg border p-2.5 text-sm"><option>Private</option><option>Public</option><option>Faith-based</option><option>Other</option></select></label>
          <label class="text-xs font-semibold">Curriculum<select id="ssCurriculum" class="mt-1 w-full rounded-lg border p-2.5 text-sm"><option value="To confirm">To confirm</option><option>British</option><option>Nigerian</option><option>Montessori</option><option>Mixed</option><option>Other</option></select></label>
        </div>
        <div><p class="text-xs font-bold mb-2">What does the school want to achieve?</p><div class="grid grid-cols-2 gap-2 text-xs">
          <label class="flex gap-2 items-center"><input type="checkbox" name="ssGoal" value="practical STEM"> Practical STEM</label>
          <label class="flex gap-2 items-center"><input type="checkbox" name="ssGoal" value="robotics"> Robotics</label>
          <label class="flex gap-2 items-center"><input type="checkbox" name="ssGoal" value="projects"> Engineering projects</label>
          <label class="flex gap-2 items-center"><input type="checkbox" name="ssGoal" value="competitions"> Competitions / exhibitions</label>
          <label class="flex gap-2 items-center"><input type="checkbox" name="ssGoal" value="lab"> STEM laboratory</label>
          <label class="flex gap-2 items-center"><input type="checkbox" name="ssGoal" value="teacher"> Teacher development</label>
          <label class="flex gap-2 items-center"><input type="checkbox" name="ssGoal" value="club"> STEM club / holiday programme</label>
        </div></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="text-xs font-semibold">Classes / levels<input id="ssClasses" class="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="e.g. JSS1–JSS3"></label>
          <label class="text-xs font-semibold">Learners<input id="ssLearners" type="number" min="1" value="30" class="mt-1 w-full rounded-lg border p-2.5 text-sm"></label>
          <label class="text-xs font-semibold">Groups<input id="ssGroups" type="number" min="1" value="1" class="mt-1 w-full rounded-lg border p-2.5 text-sm"></label>
          <label class="text-xs font-semibold">Sessions<input id="ssSessions" type="number" min="1" value="1" class="mt-1 w-full rounded-lg border p-2.5 text-sm"></label>
          <label class="text-xs font-semibold">Visits<input id="ssVisits" type="number" min="1" value="1" class="mt-1 w-full rounded-lg border p-2.5 text-sm"></label>
          <label class="text-xs font-semibold">Instructors<input id="ssInstructors" type="number" min="1" value="1" class="mt-1 w-full rounded-lg border p-2.5 text-sm"></label>
          <label class="text-xs font-semibold">Frequency<select id="ssFrequency" class="mt-1 w-full rounded-lg border p-2.5 text-sm"><option value="one-off">One-off</option><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="termly">Termly</option></select></label>
          <label class="text-xs font-semibold">Duration<select id="ssDuration" class="mt-1 w-full rounded-lg border p-2.5 text-sm"><option value="session">Single session</option><option value="short course">Short course</option><option value="term">Full term</option><option value="annual">Academic year</option></select></label>
          <label class="text-xs font-semibold">Existing facilities<select id="ssLab" class="mt-1 w-full rounded-lg border p-2.5 text-sm"><option value="unknown">Not confirmed</option><option value="none">No STEM lab</option><option value="basic">Basic facilities</option><option value="equipped">Equipped lab</option></select></label>
          <label class="text-xs font-semibold">Budget position<select id="ssBudget" class="mt-1 w-full rounded-lg border p-2.5 text-sm"><option value="not discussed">Not discussed</option><option value="limited">Limited</option><option value="moderate">Moderate</option><option value="flexible">Flexible</option><option value="school wants our price">School wants EazyLife to propose</option></select></label>
        </div>
        <label class="block text-xs font-semibold">Facilities / resources available<textarea id="ssFacilities" rows="2" class="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="Classroom, power, projector, existing kits, storage…"></textarea></label>
        <label class="block text-xs font-semibold">Meeting notes<textarea id="ssNotes" rows="3" class="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="What they said, expectations, concerns, constraints…"></textarea></label>
        <label class="block text-xs font-semibold">Agreed next step / conclusion<textarea id="ssConclusion" rows="2" class="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="What was agreed, what needs confirmation…"></textarea></label>
        <div class="rounded-xl bg-teal-50 border border-teal-100 p-3"><p class="text-[10px] uppercase tracking-wide text-teal-800 font-bold">Recommended engagement model</p><p id="ssModel" class="font-black text-sm text-teal-900 mt-1">STEM Experience</p><p class="text-[10px] text-teal-800 mt-1">A rules-based starting recommendation, not an automatic commitment.</p></div>
        <button id="ssSaveMeeting" class="w-full rounded-xl bg-slate-900 text-white py-3 text-sm font-bold">Save school meeting</button>
      </section>
      <section class="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <div><h3 class="font-black text-base">Internal costing and negotiation</h3><p class="text-[11px] text-slate-500">Only administrators can read these settings and estimates.</p></div>
        <div id="ssRateInputs" class="grid grid-cols-1 sm:grid-cols-2 gap-3"></div>
        <button id="ssSavePricing" class="w-full rounded-xl border border-slate-300 py-2.5 text-xs font-bold">Save internal rate card</button>
        <div id="ssEstimate"></div>
        <label class="block text-xs font-semibold">School's proposed offer (₦)<input id="ssOffer" type="number" min="0" inputmode="numeric" class="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="Enter their offer"></label>
        <div id="ssNegotiationResult" class="rounded-xl bg-slate-50 p-3 text-xs">Enter a school's offer to assess it.</div>
      </section>
      <section class="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <div><h3 class="font-black text-base">School-facing summary</h3><p class="text-[11px] text-slate-500">This output deliberately excludes internal costs, margins and negotiation limits.</p></div>
        <textarea id="ssProposal" rows="12" class="w-full rounded-xl border p-3 text-xs" readonly></textarea>
        <div class="grid grid-cols-2 gap-2"><button id="ssGenerateProposal" class="rounded-xl bg-teal-600 text-white py-2.5 text-xs font-bold">Generate summary</button><button id="ssCopyProposal" class="rounded-xl border py-2.5 text-xs font-bold">Copy summary</button></div>
      </section>
      <section class="bg-white rounded-2xl p-4 shadow-sm space-y-3"><h3 class="font-black text-base">Saved school meetings</h3><div id="ssMeetingList" class="space-y-2"></div></section>
    </div>`;

  const recalcIds = ["ssLearners","ssGroups","ssSessions","ssVisits","ssInstructors","ssOffer","ssFrequency","ssDuration","ssLab"];
  recalcIds.forEach(id => document.getElementById(id)?.addEventListener("input", () => {
    document.getElementById("ssModel").textContent = modelFor(checked("ssGoal"), val("ssFrequency"), val("ssDuration"), val("ssLab"));
    renderEstimate();
  }));
  document.querySelectorAll('[name="ssGoal"]').forEach(x => x.addEventListener("change", () => {
    document.getElementById("ssModel").textContent = modelFor(checked("ssGoal"), val("ssFrequency"), val("ssDuration"), val("ssLab"));
  }));
  document.getElementById("ssSaveMeeting").addEventListener("click", () => saveMeeting().catch(e => alert("Could not save meeting: " + e.message)));
  document.getElementById("ssSavePricing").addEventListener("click", () => savePricing().catch(e => alert("Could not save pricing: " + e.message)));
  document.getElementById("ssGenerateProposal").addEventListener("click", () => { document.getElementById("ssProposal").value = buildSchoolSummary(); });
  document.getElementById("ssCopyProposal").addEventListener("click", async () => {
    const text = document.getElementById("ssProposal").value || buildSchoolSummary();
    try { await navigator.clipboard.writeText(text); alert("School-facing summary copied."); }
    catch { document.getElementById("ssProposal").value = text; alert("Select and copy the summary manually."); }
  });
  loadData();
}
