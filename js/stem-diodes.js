/* Module 05: diode behavioural model and knowledge check */
(()=>{
 const $=id=>document.getElementById(id);
 const fmt=n=>Number(n).toLocaleString(undefined,{maximumFractionDigits:3});
 function update(){
  const v=Number($("dle-voltage").value),r=Number($("dle-resistance").value),vf=Number($("dle-drop").value),mode=$("dle-polarity").value;
  const feedback=$("dle-feedback");
  if(!Number.isFinite(v)||v<0||!Number.isFinite(r)||r<=0||!Number.isFinite(vf)||vf<0){feedback.textContent="Enter a non-negative supply voltage and forward drop, and a positive series resistance.";return;}
  let current=0,vr=0,state="Blocking / open";
  if(mode==="forward"){current=Math.max(0,(v-vf)/r);vr=current*r;state=current>0?"Conducting":"Below assumed forward drop";feedback.textContent=current>0?"Forward-biased: estimated current flows through the diode and series resistor.":"The supply does not exceed the assumed forward drop, so this simple model estimates no current.";}
  else if(mode==="reverse"){feedback.textContent="Reverse-biased: the ideal learning model treats the diode as blocking. Real devices have small leakage current and a reverse-voltage limit.";state="Reverse blocking";}
  else{feedback.textContent="Open circuit: the path is broken, so the model estimates zero current.";state="Open circuit";}
  $("dle-current").textContent=fmt(current*1000)+" mA";
  $("dle-resistor-voltage").textContent=fmt(vr)+" V";
  $("dle-state").textContent=state;
  const visual=$("dle-visual");visual.classList.toggle("reverse",mode==="reverse");visual.classList.toggle("open",mode==="open");
 }
 ["dle-voltage","dle-resistance","dle-drop","dle-polarity"].forEach(id=>$(id).addEventListener("input",update));
 $("dle-quiz").addEventListener("click",event=>{
  const button=event.target.closest("button[data-correct]");if(!button||button.disabled)return;
  const question=button.closest(".dle-question");question.querySelectorAll("button").forEach(b=>{b.disabled=true;if(b.dataset.correct==="true")b.classList.add("correct");});
  if(button.dataset.correct==="true")question.querySelector("p").textContent="Correct. You have identified the key diode principle.";
  else{button.classList.add("incorrect");question.querySelector("p").textContent="Not quite. The correct answer is highlighted. Review the explanation and try the next question.";}
 });
 update();const year=$("sl-year");if(year)year.textContent=new Date().getFullYear();
})();