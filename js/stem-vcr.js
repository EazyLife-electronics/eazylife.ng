(function(){
  const byId=id=>document.getElementById(id);
  const number=id=>{const raw=byId(id).value.trim();return raw===""?null:Number(raw);};
  const fmt=(value,digits=3)=>Number(value).toLocaleString("en-US",{maximumSignificantDigits:digits});
  const prettyResistance=value=>value>=1e6?fmt(value/1e6)+" MΩ":value>=1e3?fmt(value/1e3)+" kΩ":fmt(value)+" Ω";
  const prettyCurrent=value=>Math.abs(value)>=1?fmt(value)+" A":Math.abs(value)>=.001?fmt(value*1000)+" mA":fmt(value*1e6)+" µA";
  const calcButton=byId("vcr-calculate");
  function calculateOhms(){
    const ids=["vcr-voltage","vcr-current","vcr-resistance"];
    const vals=ids.map(number), filled=vals.filter(v=>v!==null);
    const feedback=byId("vcr-feedback"),result=byId("vcr-result-value"),caption=byId("vcr-result-caption"),equation=byId("vcr-equation");
    if(filled.length!==2||vals.some(v=>v!==null&&(!Number.isFinite(v)||v<0))){
      feedback.textContent="Enter exactly two valid non-negative values. Leave the quantity to calculate blank.";
      result.textContent="Check inputs";caption.textContent="Two known quantities are required.";equation.textContent="V = I × R";return;
    }
    let [v,i,r]=vals,answer,label,eq;
    if(v===null){if(i===0||r===null){feedback.textContent="To calculate voltage, current and resistance must both be non-zero/valid.";return;}v=i*r;answer=fmt(v)+" V";label="Voltage across the component";eq="V = I × R = "+fmt(i)+" × "+prettyResistance(r)+" = "+fmt(v)+" V";}
    else if(i===null){if(r===0){feedback.textContent="Resistance cannot be zero when calculating current.";return;}i=v/r;answer=prettyCurrent(i);label="Current through the component";eq="I = V ÷ R = "+fmt(v)+" ÷ "+prettyResistance(r)+" = "+fmt(i)+" A";}
    else{if(i===0){feedback.textContent="Current must be greater than zero when calculating resistance.";return;}r=v/i;answer=prettyResistance(r);label="Resistance of the component";eq="R = V ÷ I = "+fmt(v)+" ÷ "+fmt(i)+" = "+prettyResistance(r);}
    result.textContent=answer;caption.textContent=label;equation.textContent=eq;feedback.textContent="Calculation complete. Compare this ideal value with a real measurement when you build the circuit.";
  }
  calcButton.addEventListener("click",calculateOhms);
  byId("vcr-reset").addEventListener("click",()=>{byId("vcr-voltage").value="9";byId("vcr-current").value="";byId("vcr-resistance").value="1000";calculateOhms();});
  function updateNetworks(){
    const supply=number("vcr-network-voltage");
    const pairs=[["series","series"],["parallel","parallel"]];
    if(supply===null||!Number.isFinite(supply)||supply<0){byId("vcr-network-feedback").textContent="Enter a valid non-negative supply voltage.";return;}
    for(const [prefix,type] of pairs){
      const r1=number("vcr-"+prefix+"-r1"),r2=number("vcr-"+prefix+"-r2");
      if(r1===null||r2===null||!Number.isFinite(r1)||!Number.isFinite(r2)||r1<=0||r2<=0){
        byId("vcr-"+prefix+"-equivalent").textContent="Check values";byId("vcr-"+prefix+"-current").textContent="—";continue;
      }
      const equivalent=type==="series"?r1+r2:1/(1/r1+1/r2),current=supply/equivalent;
      byId("vcr-"+prefix+"-equivalent").textContent=prettyResistance(equivalent);
      byId("vcr-"+prefix+"-current").textContent=prettyCurrent(current);
    }
    byId("vcr-network-feedback").textContent="Both networks use an ideal "+fmt(supply)+" V source. The values update as you edit the resistors.";
  }
  ["vcr-network-voltage","vcr-series-r1","vcr-series-r2","vcr-parallel-r1","vcr-parallel-r2"].forEach(id=>byId(id).addEventListener("input",updateNetworks));
  function quizHandler(event){
    const button=event.target.closest("button[data-correct]");if(!button)return;
    const question=button.closest(".vcr-question");if(!question)return;
    question.querySelectorAll("button").forEach(b=>{b.disabled=true;b.classList.toggle("correct",b.dataset.correct==="true");});
    if(button.dataset.correct==="true"){question.querySelector(".vcr-quiz-feedback").textContent="Correct. Good reasoning!";}
    else{button.classList.add("incorrect");question.querySelector(".vcr-quiz-feedback").textContent="Not quite. The correct answer is highlighted. Review the explanation and try the next question.";}
  }
  byId("vcr-quiz").addEventListener("click",quizHandler);
  document.querySelectorAll(".vcr-question").forEach(q=>q.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{})));
  calculateOhms();updateNetworks();
  const year=byId("sl-year");if(year)year.textContent=new Date().getFullYear();
})();