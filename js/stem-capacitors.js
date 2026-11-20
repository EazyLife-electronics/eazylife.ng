/* Module 06: ideal RC model, capacitor combination calculator and knowledge check */
(()=>{
 const $=id=>document.getElementById(id);
 const fmt=(n,d=3)=>Number(n).toLocaleString(undefined,{maximumFractionDigits:d});
 const inputs=["cel-supply","cel-resistance","cel-capacitance","cel-mode","cel-time"];
 const get=()=>({v:Number($("cel-supply").value),r:Number($("cel-resistance").value),c:Number($("cel-capacitance").value)*1e-6,mode:$("cel-mode").value,tau:Number($("cel-resistance").value)*Number($("cel-capacitance").value)*1e-6,t:Number($("cel-time").value)});
 function updateRC(){
  const x=get(),feedback=$("cel-feedback");
  if(!Number.isFinite(x.v)||x.v<=0||x.v>24||!Number.isFinite(x.r)||x.r<100||x.r>1e7||!Number.isFinite(x.c)||x.c<=0||!Number.isFinite(x.tau)||x.tau<=0){feedback.textContent="Use a supply from 0.1 to 24 V, resistance from 100 Ω to 10 MΩ, and a positive capacitance.";return;}
  const fraction=x.mode==="charge"?1-Math.exp(-x.t):Math.exp(-x.t);
  const vc=x.v*fraction,seconds=x.t*x.tau,q=x.c*vc,e=.5*x.c*vc*vc;
  $("cel-time-value").textContent=fmt(x.t,1)+" τ";
  $("cel-voltage").textContent=fmt(vc,4)+" V";
  $("cel-seconds").textContent=fmt(seconds,4)+" s";
  $("cel-tau").textContent=fmt(x.tau,4)+" s";
  $("cel-percent").textContent=fmt(fraction*100,1)+"%";
  $("cel-progress").style.width=(fraction*100)+"%";
  $("cel-charge").textContent=fmt(q*1e6,3)+" µC";
  $("cel-energy").textContent=e>=.001?fmt(e*1000,3)+" mJ":fmt(e*1e6,3)+" µJ";
  const points=[];
  for(let i=0;i<=100;i++){const tau=5*i/100,f=x.mode==="charge"?1-Math.exp(-tau):Math.exp(-tau),px=42+438*i/100,py=165-150*f;points.push((i?"L":"M")+px.toFixed(2)+" "+py.toFixed(2));}
  $("cel-curve").setAttribute("d",points.join(" "));
  const mx=42+438*x.t/5,my=165-150*fraction;
  $("cel-marker").setAttribute("d","M"+mx+" 15 V165");$("cel-dot").setAttribute("cx",mx);$("cel-dot").setAttribute("cy",my);
  if(x.mode==="charge")feedback.textContent=x.t===0?"The capacitor starts uncharged. Increase elapsed time to watch its voltage rise.":"Charging: after "+fmt(x.t,1)+" time constants, the capacitor has reached "+fmt(fraction*100,1)+"% of its final voltage.";
  else feedback.textContent="Discharging: after "+fmt(x.t,1)+" time constants, "+fmt(fraction*100,1)+"% of the initial voltage remains.";
 }
 inputs.forEach(id=>$(id).addEventListener("input",updateRC));
 $("cel-run").addEventListener("click",()=>{$("cel-time").value=5;updateRC();});
 $("cel-reset").addEventListener("click",()=>{$("cel-supply").value=5;$("cel-resistance").value=10000;$("cel-capacitance").value=100;$("cel-mode").value="charge";$("cel-time").value=1;updateRC();});
 function updateCombination(){
  const a=Number($("cel-c1").value),b=Number($("cel-c2").value),mode=$("cel-combination").value,out=$("cel-equivalent");
  if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<=0){out.textContent="Enter two positive capacitance values";return;}
  const result=mode==="parallel"?a+b:(a*b)/(a+b);
  out.textContent=fmt(result,5)+" µF";
 }
 ["cel-c1","cel-c2","cel-combination"].forEach(id=>$(id).addEventListener("input",updateCombination));
 $("cel-quiz").addEventListener("click",event=>{
  const button=event.target.closest("button[data-correct]");if(!button||button.disabled)return;
  const question=button.closest(".cel-question");
  question.querySelectorAll("button").forEach(b=>{b.disabled=true;if(b.dataset.correct==="true")b.classList.add("correct");});
  question.querySelector("p").textContent=button.dataset.correct==="true"?"Correct. You have understood the key capacitor principle.":"Not quite. The correct answer is highlighted. Review the lesson and continue.";
  if(button.dataset.correct!=="true")button.classList.add("incorrect");
 });
 updateRC();updateCombination();const year=$("sl-year");if(year)year.textContent=new Date().getFullYear();
})();