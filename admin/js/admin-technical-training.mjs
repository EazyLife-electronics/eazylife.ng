// Private EazyLife out-of-school technical training workspace.
import {
  collection, addDoc, getDocs, getDoc, setDoc, doc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initFirebase } from "../../js/firebase.mjs";

const { db } = initFirebase();
const COURSES = [
  ["A1","Practical STEM Foundations","Practical STEM and Electronics"],
  ["A2","Electronics and Circuit Design","Practical STEM and Electronics"],
  ["A3","Electronic Testing, Measurement and Troubleshooting","Practical STEM and Electronics"],
  ["A4","PCB Design, Assembly and Prototyping","Practical STEM and Electronics"],
  ["B1","Microcontrollers and Arduino Engineering","Embedded Systems and Intelligent Devices"],
  ["B2","ESP32 and Advanced Embedded Systems","Embedded Systems and Intelligent Devices"],
  ["B3","Sensors, Instrumentation and Data Acquisition","Embedded Systems and Intelligent Devices"],
  ["B4","IoT and Connected Embedded Systems","Embedded Systems and Intelligent Devices"],
  ["B5","Embedded Product Development","Embedded Systems and Intelligent Devices"],
  ["C1","Robotics Foundations and Mobile Robotics","Robotics and Automation"],
  ["C2","Robotic Mechanisms, Motors and Actuators","Robotics and Automation"],
  ["C3","Robot Sensing, Navigation and Control","Robotics and Automation"],
  ["C4","Mechatronics and Integrated Robotics","Robotics and Automation"],
  ["C5","Advanced Robotics and Autonomous Systems","Robotics and Automation"]
].map(([id,name,family])=>({id,name,family}));
const LEVELS = ["Beginner","Mid-level","Master"];
const DURATIONS = [5,10];
const DELIVERY = ["Physical at EazyLife","Hybrid","Institutional placement"];
const money = n => new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(Number(n)||0);
const esc = s => String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const val = id => document.getElementById(id)?.value?.trim()||"";
const num = id => Math.max(0,Number(document.getElementById(id)?.value)||0);
let initialized=false, prices={}, fees={registration:0,materialsPerCourse:0,assessmentPerCourse:0,certificationPerCourse:0,physicalPerLearner:0,hybridPerLearner:0,institutionalPerLearner:0};
let leads=[];
const key = (course,level,months)=>course+"_"+level.toLowerCase().replace("-","")+"_"+months;
function defaultPriceMap(){const p={};COURSES.forEach(c=>LEVELS.forEach(l=>DURATIONS.forEach(d=>p[key(c.id,l,d)]=0)));return p;}
function selectedCourses(){return [...document.querySelectorAll('[name="ttCourse"]:checked')].map(x=>COURSES.find(c=>c.id===x.value)).filter(Boolean);}
function deliveryFee(mode){return mode==="Hybrid"?fees.hybridPerLearner:mode==="Institutional placement"?fees.institutionalPerLearner:fees.physicalPerLearner;}
function calculate(){
 const courses=selectedCourses(), level=val("ttLevel"), months=num("ttDuration"), learners=Math.max(1,num("ttLearners")), mode=val("ttDelivery");
 const lines=courses.map(c=>({id:c.id,name:c.name,unit:Number(prices[key(c.id,level,months)])||0}));
 const tuitionPerLearner=lines.reduce((s,x)=>s+x.unit,0);
 const extrasPerLearner=fees.materialsPerCourse*courses.length+fees.assessmentPerCourse*courses.length+fees.certificationPerCourse*courses.length+deliveryFee(mode);
 const perLearner=tuitionPerLearner+extrasPerLearner+fees.registration;
 return {courses,lines,level,months,learners,mode,tuitionPerLearner,extrasPerLearner,perLearner,total:perLearner*learners,configured:lines.length>0&&lines.every(x=>x.unit>0)};
}
function renderCourses(){
 const host=document.getElementById("ttCourseList");if(!host)return;
 host.innerHTML=["Practical STEM and Electronics","Embedded Systems and Intelligent Devices","Robotics and Automation"].map(f=>'<section class="rounded-xl border p-3 space-y-2"><h4 class="text-xs font-black">'+esc(f)+'</h4><div class="grid sm:grid-cols-2 gap-2">'+COURSES.filter(c=>c.family===f).map(c=>'<label class="flex gap-2 items-start rounded-lg bg-slate-50 p-3 text-xs cursor-pointer has-[:checked]:bg-teal-50"><input type="checkbox" name="ttCourse" value="'+c.id+'" class="mt-0.5"><span><b>'+c.id+' · '+esc(c.name)+'</b></span></label>').join("")+'</div></section>').join("");
 host.querySelectorAll("input").forEach(x=>x.addEventListener("change",renderEstimate));
}
function renderPriceEditor(){
 const host=document.getElementById("ttPriceMatrix");if(!host)return;
 host.innerHTML='<div class="overflow-x-auto"><table class="w-full text-[10px] min-w-[680px]"><thead><tr><th class="text-left p-2">Specialisation</th>'+LEVELS.flatMap(l=>DURATIONS.map(d=>'<th class="p-1">'+l+'<br>'+d+' months</th>')).join("")+'</tr></thead><tbody>'+COURSES.map(c=>'<tr class="border-t"><td class="p-2 font-semibold">'+c.id+' · '+esc(c.name)+'</td>'+LEVELS.flatMap(l=>DURATIONS.map(d=>'<td class="p-1"><input data-price-key="'+key(c.id,l,d)+'" type="number" min="0" inputmode="numeric" value="'+(Number(prices[key(c.id,l,d)])||0)+'" class="w-24 max-w-full border rounded-lg p-2 text-xs" aria-label="'+esc(c.name)+' '+l+' '+d+' month price"></td>')).join("")+'</tr>').join("")+'</tbody></table></div>';
 host.querySelectorAll("[data-price-key]").forEach(input=>input.addEventListener("input",()=>{prices[input.dataset.priceKey]=Math.max(0,Number(input.value)||0);renderEstimate();}));
}
function renderFees(){
 const host=document.getElementById("ttFeeInputs");if(!host)return;
 const labels={registration:"Registration / onboarding (per learner)",materialsPerCourse:"Learning materials (per course, per learner)",assessmentPerCourse:"Assessment (per course, per learner)",certificationPerCourse:"Certification and portfolio (per course, per learner)",physicalPerLearner:"Physical delivery add-on (per learner)",hybridPerLearner:"Hybrid delivery add-on (per learner)",institutionalPerLearner:"Institutional placement add-on (per learner)"};
 host.innerHTML=Object.entries(labels).map(([k,l])=>'<label class="text-[11px] font-semibold">'+l+'<input data-fee-key="'+k+'" type="number" min="0" inputmode="numeric" value="'+(Number(fees[k])||0)+'" class="mt-1 w-full rounded-lg border p-2.5 text-sm"></label>').join("");
 host.querySelectorAll("[data-fee-key]").forEach(input=>input.addEventListener("input",()=>{fees[input.dataset.feeKey]=Math.max(0,Number(input.value)||0);renderEstimate();}));
}
function renderEstimate(){
 const host=document.getElementById("ttEstimate");if(!host)return;const c=calculate();
 host.innerHTML='<div class="grid grid-cols-2 gap-2"><div class="rounded-xl bg-slate-50 p-3"><p class="text-[10px] text-slate-500">Fee per learner</p><b>'+money(c.perLearner)+'</b></div><div class="rounded-xl bg-teal-50 p-3"><p class="text-[10px] text-teal-700">Total for '+c.learners+' learner(s)</p><b class="text-teal-800">'+money(c.total)+'</b></div></div><div class="text-xs space-y-1 mt-3">'+c.lines.map(x=>'<p class="flex justify-between gap-2"><span>'+esc(x.id+' · '+x.name)+'</span><b>'+money(x.unit)+'</b></p>').join("")+'<p class="flex justify-between border-t pt-2"><span>Registration, materials, assessment, certification and delivery</span><b>'+money(c.extrasPerLearner+fees.registration)+'</b></p></div><p class="text-[10px] mt-2 '+(c.configured?'text-slate-500':'text-amber-700')+'">'+(c.configured?'Configured course prices shown. Confirm final scope before issuing a quote.':'Select at least one course and configure a non-zero price for every selected specialisation, level and duration.')+'</p>';
 const quote=document.getElementById("ttQuote");if(quote)quote.value=buildQuote(c);
}
function buildQuote(c=calculate()){
 const learner=val("ttName")||"Learner / Client";
 return ["EazyLife Technical Training","Learner / Client: "+learner,"Institution: "+(val("ttInstitution")||"Not specified"),"Competency level: "+c.level,"Duration: "+c.months+" months","Delivery: "+c.mode,"Number of learners: "+c.learners,"","Selected specialisations:",...c.lines.map(x=>"- "+x.id+" "+x.name+": "+money(x.unit)),"","Fee per learner: "+money(c.perLearner),"Total programme fee: "+money(c.total),"","The programme is practical and competency-based. Final admission, placement level, project scope and delivery schedule are subject to assessment and confirmation.","Prepared by EazyLife Robotics and Electronics Solutions"].join("\n");
}
async function saveLead(){
 const name=val("ttName"),c=calculate();if(!name){alert("Enter the learner or client name.");return;}if(!c.courses.length){alert("Select at least one specialisation.");return;}
 const record={name,phone:val("ttPhone"),email:val("ttEmail"),institution:val("ttInstitution"),clientType:val("ttClientType"),level:c.level,durationMonths:c.months,delivery:c.mode,learners:c.learners,courses:c.lines,feePerLearner:c.perLearner,totalFee:c.total,status:val("ttStatus"),notes:val("ttNotes"),createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
 try{const ref=await addDoc(collection(db,"technicalTrainingLeads"),record);leads.unshift({...record,id:ref.id});renderLeads();alert("Technical training record saved.");}catch(e){alert("Could not save record: "+e.message);}
}
function renderLeads(){
 const host=document.getElementById("ttLeadList");if(!host)return;
 host.innerHTML=leads.length?leads.map(x=>'<article class="rounded-xl border p-3"><div class="flex justify-between gap-2"><b class="text-sm">'+esc(x.name)+'</b><span class="text-[10px] rounded-full bg-slate-100 px-2 py-1">'+esc(x.status||"Enquiry")+'</span></div><p class="text-[11px] text-slate-500">'+esc(x.institution||x.clientType||"Private learner")+' · '+esc(x.level)+' · '+esc(x.durationMonths)+' months · '+esc(x.delivery)+'</p><p class="text-xs mt-2">'+(x.courses||[]).map(c=>esc(c.id+" "+c.name)).join(" · ")+'</p><p class="font-black text-sm mt-2">'+money(x.totalFee)+'</p></article>').join(""):'<p class="text-xs text-slate-400">No technical training records saved yet.</p>';
}
async function loadData(){
 try{
  const p=await getDoc(doc(db,"technicalTrainingPricing","default"));
  if(p.exists()){const d=p.data();prices={...defaultPriceMap(),...(d.prices||{})};fees={...fees,...(d.fees||{})};}
  const snap=await getDocs(query(collection(db,"technicalTrainingLeads"),orderBy("createdAt","desc")));
  leads=snap.docs.map(d=>({id:d.id,...d.data()}));
 }catch(e){console.error("Technical training data load failed",e);const s=document.getElementById("ttLoadStatus");if(s)s.textContent="Could not load private training data. Confirm Firestore rules are deployed.";}
 renderPriceEditor();renderFees();renderEstimate();renderLeads();
}
export function resetTechnicalTraining(){initialized=false;prices={};fees={registration:0,materialsPerCourse:0,assessmentPerCourse:0,certificationPerCourse:0,physicalPerLearner:0,hybridPerLearner:0,institutionalPerLearner:0};leads=[];const h=document.getElementById("technicalTrainingContent");if(h)h.innerHTML="";document.querySelector('[data-tab="technical-training"]')?.classList.add("hidden");}
export function initTechnicalTraining(){
 if(initialized)return;initialized=true;document.querySelector('[data-tab="technical-training"]')?.classList.remove("hidden");
 const host=document.getElementById("technicalTrainingContent");if(!host)return;
 prices=defaultPriceMap();
 host.innerHTML=`
 <div class="space-y-4">
  <section class="rounded-2xl bg-slate-900 text-white p-5"><p class="text-[10px] uppercase tracking-widest text-teal-300 font-bold">EazyLife internal workspace</p><h2 class="text-xl font-black mt-1">Technical Training Assistant</h2><p class="text-xs text-slate-300 mt-2">Prepare a training offer, configure course fees and keep private learner or institutional enquiries.</p><div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-center text-[11px] font-bold"><a href="#ttEnquiry" class="rounded-lg bg-white/10 p-3">1. Enquiry</a><a href="#ttPricing" class="rounded-lg bg-white/10 p-3">2. Pricing</a><a href="#ttQuoteSection" class="rounded-lg bg-white/10 p-3">3. Quote</a><a href="#ttRecords" class="rounded-lg bg-white/10 p-3">4. Records</a></div></section>
  <p id="ttLoadStatus" class="text-[11px] text-slate-500">Loading secure technical training records…</p>
  <section id="ttEnquiry" class="bg-white rounded-2xl p-4 shadow-sm space-y-3"><div><h3 class="font-black">1. Learner or institutional enquiry</h3><p class="text-[11px] text-slate-500">Learners enrol in individual specialisations. Select multiple only when the proposed enrolment genuinely includes them.</p></div>
   <div class="grid sm:grid-cols-2 gap-3">
    <label class="text-xs font-semibold">Learner / client name<input id="ttName" class="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="Full name or organisation"></label>
    <label class="text-xs font-semibold">Client type<select id="ttClientType" class="mt-1 w-full rounded-lg border p-2.5 text-sm"><option>Private learner</option><option>Institution / organisation</option></select></label>
    <label class="text-xs font-semibold">Institution (optional)<input id="ttInstitution" class="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="School, company or institution"></label>
    <label class="text-xs font-semibold">Phone<input id="ttPhone" class="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="Phone number"></label>
    <label class="text-xs font-semibold">Email<input id="ttEmail" type="email" class="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="Email address"></label>
    <label class="text-xs font-semibold">Competency level<select id="ttLevel" class="mt-1 w-full rounded-lg border p-2.5 text-sm">${LEVELS.map(x=>'<option>'+x+'</option>').join("")}</select></label>
    <label class="text-xs font-semibold">Duration<select id="ttDuration" class="mt-1 w-full rounded-lg border p-2.5 text-sm"><option value="5">5 months</option><option value="10">10 months</option></select></label>
    <label class="text-xs font-semibold">Delivery mode<select id="ttDelivery" class="mt-1 w-full rounded-lg border p-2.5 text-sm">${DELIVERY.map(x=>'<option>'+x+'</option>').join("")}</select></label>
    <label class="text-xs font-semibold">Number of learners<input id="ttLearners" type="number" min="1" value="1" inputmode="numeric" class="mt-1 w-full rounded-lg border p-2.5 text-sm"></label>
    <label class="text-xs font-semibold">Enquiry status<select id="ttStatus" class="mt-1 w-full rounded-lg border p-2.5 text-sm"><option>Enquiry</option><option>Quoted</option><option>Enrolled</option><option>In training</option><option>Completed</option><option>Not proceeding</option></select></label>
   </div>
   <div><p class="text-xs font-bold mb-2">Select specialisations</p><div id="ttCourseList" class="space-y-3"></div></div>
   <label class="block text-xs font-semibold">Internal notes<textarea id="ttNotes" rows="2" class="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="Placement assessment, prerequisites, learner goals…"></textarea></label>
   <button id="ttSaveLead" class="w-full rounded-xl bg-slate-900 text-white py-3 text-sm font-bold">Save training record</button>
  </section>
  <section id="ttPricing" class="bg-white rounded-2xl p-4 shadow-sm space-y-3"><div><h3 class="font-black">2. Private technical training price catalogue</h3><p class="text-[11px] text-slate-500">Set the fee per learner for each specialisation, competency level and duration. Zero means not configured, not free.</p></div><div id="ttPriceMatrix"></div><div><h4 class="font-bold text-xs mb-2">Additional fees</h4><div id="ttFeeInputs" class="grid sm:grid-cols-2 gap-3"></div></div><button id="ttSavePricing" class="w-full rounded-xl border py-3 text-xs font-bold">Save technical training prices</button></section>
  <section id="ttQuoteSection" class="bg-white rounded-2xl p-4 shadow-sm space-y-3"><div><h3 class="font-black">3. Calculate and prepare a quote</h3><p class="text-[11px] text-slate-500">This summary is customer-facing. It excludes internal notes and pricing configuration.</p></div><div id="ttEstimate"></div><textarea id="ttQuote" rows="13" readonly class="w-full rounded-xl border p-3 text-xs"></textarea><div class="grid grid-cols-2 gap-2"><button id="ttRefreshQuote" class="rounded-xl bg-teal-600 text-white py-2.5 text-xs font-bold">Refresh quote</button><button id="ttCopyQuote" class="rounded-xl border py-2.5 text-xs font-bold">Copy quote</button></div></section>
  <section id="ttRecords" class="bg-white rounded-2xl p-4 shadow-sm space-y-3"><h3 class="font-black">4. Saved technical training records</h3><div id="ttLeadList" class="space-y-2"></div></section>
 </div>`;
 renderCourses();
 ["ttLevel","ttDuration","ttDelivery","ttLearners","ttName","ttInstitution"].forEach(id=>document.getElementById(id)?.addEventListener("input",renderEstimate));
 document.getElementById("ttSavePricing").addEventListener("click",async()=>{try{await setDoc(doc(db,"technicalTrainingPricing","default"),{prices,fees,updatedAt:serverTimestamp()});alert("Technical training prices saved securely.");}catch(e){alert("Could not save prices: "+e.message);}});
 document.getElementById("ttSaveLead").addEventListener("click",saveLead);
 document.getElementById("ttRefreshQuote").addEventListener("click",()=>{document.getElementById("ttQuote").value=buildQuote();});
 document.getElementById("ttCopyQuote").addEventListener("click",async()=>{const t=buildQuote();document.getElementById("ttQuote").value=t;try{await navigator.clipboard.writeText(t);alert("Technical training quote copied.");}catch{alert("Select and copy the quote manually.");}});
 loadData();
}
