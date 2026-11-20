(function(){
  const byId=id=>document.getElementById(id);
  const number=id=>{const raw=byId(id).value.trim();return raw===""?null:Number(raw);};
  const fmt=(value,digits=3)=>Number(value).toLocaleString("en-US",{maximumSignificantDigits:digits});
  const prettyResistance=value=>value>=1e6?fmt(value/1e6)+" MΩ":value>=1e3?fmt(value/1e3)+" kΩ":fmt(value)+" Ω";
  const prettyCurrent=value=>Math.abs(value)>=1?fmt(value)+" A":Math.abs(value)>=.001?fmt(value*1000)+" mA":fmt(value*1e6)+" µA";
  const calcButton=byId("vcr-calculate");
  function calculateOhms(){
    const ids=["vcr-voltage","vcr-current","vcr-resistance"];
    const vals=ids.map(number),filled=vals.filter(v=>v!==null);
    const feedback=byId("vcr-feedback"),result=byId("vcr-result-value"),caption=byId("vcr-result-caption"),equation=byId("vcr-equation");
    if(filled.length===3){
      feedback.textContent="All three fields contain values. Leave the quantity you want to calculate blank, then calculate again.";
      result.textContent="Leave one blank";caption.textContent="The calculator needs exactly two known quantities.";equation.textContent="V = I × R";return;
    }
    if(filled.length!==2){
      feedback.textContent="Enter exactly two values and leave the quantity you want to calculate blank.";
      result.textContent="Two values needed";caption.textContent="One quantity will be calculated.";equation.textContent="V = I × R";return;
    }
    const [v,i,r]=vals;
    if(vals.some((value,index)=>value!==null&&(!Number.isFinite(value)||(index===0?value<0:value<=0)))){
      feedback.textContent="Voltage must be zero or greater. Current and resistance must each be greater than zero.";
      result.textContent="Check inputs";caption.textContent="Use valid values for the two known quantities.";equation.textContent="V = I × R";return;
    }
    let answer,label,eq,target,value;
    if(v===null){
      value=i*r;target=0;answer=fmt(value)+" V";label="Calculated voltage";eq="V = I × R = "+fmt(i)+" × "+prettyResistance(r)+" = "+fmt(value)+" V";
    }else if(i===null){
      if(r===0){feedback.textContent="Resistance must be greater than zero when calculating current.";return;}
      value=v/r;target=1;answer=prettyCurrent(value);label="Calculated current";eq="I = V ÷ R = "+fmt(v)+" ÷ "+prettyResistance(r)+" = "+fmt(value)+" A";
    }else{
      if(i===0){feedback.textContent="Current must be greater than zero when calculating resistance.";return;}
      value=v/i;target=2;answer=prettyResistance(value);label="Calculated resistance";eq="R = V ÷ I = "+fmt(v)+" ÷ "+fmt(i)+" = "+prettyResistance(value);
    }
    byId(ids[target]).value=String(value);
    result.textContent=answer;caption.textContent=label;equation.textContent=eq;
    feedback.textContent="Calculated successfully. The missing value has been filled in. Clear that field before solving for another quantity.";
  }
  calcButton.addEventListener("click",calculateOhms);
  byId("vcr-reset").addEventListener("click",()=>{byId("vcr-voltage").value="2";byId("vcr-current").value="";byId("vcr-resistance").value="1000";calculateOhms();});
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
  calculateOhms();updateNetworks();
  const year=byId("sl-year");if(year)year.textContent=new Date().getFullYear();
})();