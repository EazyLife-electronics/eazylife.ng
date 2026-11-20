(function(){
 const byId=id=>document.getElementById(id);
 const read=id=>{const raw=byId(id).value.trim();return raw===""?null:Number(raw);};
 const fmt=(n,d=4)=>Number(n).toLocaleString("en-US",{maximumSignificantDigits:d});
 const ohms=n=>n>=1e6?fmt(n/1e6)+" MΩ":n>=1e3?fmt(n/1e3)+" kΩ":fmt(n)+" Ω";
 const amps=n=>Math.abs(n)>=1?fmt(n)+" A":Math.abs(n)>=.001?fmt(n*1000)+" mA":fmt(n*1e6)+" µA";
 const e12=[10,12,15,18,22,27,33,39,47,56,68,82];
 function nearestE12(value){let best=null,diff=Infinity;for(let decade=-1;decade<=9;decade++)for(const base of e12){const candidate=base*Math.pow(10,decade);const delta=Math.abs(candidate-value);if(delta<diff||(delta===diff&&candidate>best)){diff=delta;best=candidate;}}return best;}
 function ledCalc(){
  const vs=read("rpc-supply"),vf=read("rpc-forward"),ma=read("rpc-current"),fb=byId("rpc-led-feedback");
  if([vs,vf,ma].some(v=>v===null||!Number.isFinite(v))||vs<0||vf<0||ma<=0){fb.textContent="Enter valid values. Supply and LED forward voltage cannot be negative; target current must be greater than zero.";return;}
  if(vs<=vf){fb.textContent="Supply voltage must be greater than the LED forward voltage to leave voltage across the resistor.";byId("rpc-led-resistance").textContent="No valid resistor";return;}
  const current=ma/1000,r=(vs-vf)/current,p=(vs-vf)*current,standard=nearestE12(r),actual=(vs-vf)/standard;
  byId("rpc-led-resistance").textContent=ohms(r);
  byId("rpc-led-power").textContent=fmt(p*1000)+" mW";
  byId("rpc-led-rating").textContent=(p<=.0625?".125 W":p<=.125?".25 W":p<=.25?".5 W":p<=.5?"1 W":"Select a higher rated part")+" or higher";
  byId("rpc-led-standard").textContent=ohms(standard)+" (E12)";
  byId("rpc-led-actual").textContent=amps(actual);
  byId("rpc-led-equation").textContent="R = (Vs − Vf) ÷ I = ("+fmt(vs)+" − "+fmt(vf)+") ÷ "+fmt(current)+" = "+ohms(r)+". Resistor power ≈ "+fmt(p)+" W.";
  fb.textContent="Calculation complete. The E12 value is the nearest standard value, not a guarantee of the exact target current. Check the LED datasheet and resistor derating.";
 }
 function dividerCalc(){
  const vin=read("rpc-divider-input"),r1=read("rpc-r1"),r2=read("rpc-r2"),load=read("rpc-load"),fb=byId("rpc-divider-feedback");
  if([vin,r1,r2].some(v=>v===null||!Number.isFinite(v))||vin<0||r1<=0||r2<=0||(load!==null&&(!Number.isFinite(load)||load<=0))){fb.textContent="Enter a non-negative input voltage and positive resistor values. Leave load blank for an unloaded divider.";return;}
  const unloaded=vin*r2/(r1+r2),current=vin/(r1+r2),effective=load===null?r2:1/(1/r2+1/load),loaded=vin*effective/(r1+effective);
  byId("rpc-unloaded").textContent=fmt(unloaded)+" V";
  byId("rpc-loaded").textContent=fmt(loaded)+" V";
  byId("rpc-divider-current").textContent=amps(current);
  byId("rpc-effective").textContent=ohms(effective);
  byId("rpc-divider-equation").textContent=load===null?"Vout = Vin × R2 ÷ (R1 + R2) = "+fmt(unloaded)+" V. No external load specified.":"Rlower(effective) = R2 || RL = "+ohms(effective)+". Loaded Vout = "+fmt(loaded)+" V; unloaded Vout = "+fmt(unloaded)+" V.";
  fb.textContent=load===null?"No load is connected, so loaded and unloaded output values are equal.":"Load included. Compare the two outputs to see the loading effect.";
 }
 byId("rpc-led-calculate").addEventListener("click",ledCalc);
 ["rpc-supply","rpc-forward","rpc-current"].forEach(id=>byId(id).addEventListener("input",ledCalc));
 byId("rpc-divider-calculate").addEventListener("click",dividerCalc);
 ["rpc-divider-input","rpc-r1","rpc-r2","rpc-load"].forEach(id=>byId(id).addEventListener("input",dividerCalc));
 byId("rpc-quiz").addEventListener("click",event=>{
  const button=event.target.closest("button[data-correct]");if(!button||button.disabled)return;
  const question=button.closest(".rpc-question");question.querySelectorAll("button").forEach(b=>{b.disabled=true;if(b.dataset.correct==="true")b.classList.add("correct");});
  if(button.dataset.correct==="true")question.querySelector("p").textContent="Correct. You have identified the key circuit principle.";
  else{button.classList.add("incorrect");question.querySelector("p").textContent="Not quite. The correct answer is highlighted above. Review the explanation and continue.";}
 });
 ledCalc();dividerCalc();
 const year=byId("sl-year");if(year)year.textContent=new Date().getFullYear();
})();