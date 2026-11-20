/* EazyLife STEM Lab: resistor colour-code calculator (4-band and 5-band). */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const colours = [
    {name:'Black',hex:'#000000',digit:0,multiplier:1},
    {name:'Brown',hex:'#8b4513',digit:1,multiplier:10,tolerance:1},
    {name:'Red',hex:'#ff0000',digit:2,multiplier:100,tolerance:2},
    {name:'Orange',hex:'#ff8800',digit:3,multiplier:1000},
    {name:'Yellow',hex:'#ffff00',digit:4,multiplier:10000},
    {name:'Green',hex:'#008000',digit:5,multiplier:100000,tolerance:0.5},
    {name:'Blue',hex:'#0000ff',digit:6,multiplier:1000000,tolerance:0.25},
    {name:'Violet',hex:'#800080',digit:7,multiplier:10000000,tolerance:0.1},
    {name:'Grey',hex:'#808080',digit:8,multiplier:100000000,tolerance:0.05},
    {name:'White',hex:'#ffffff',digit:9,multiplier:1000000000},
    {name:'Gold',hex:'#d4af37',multiplier:0.1,tolerance:5},
    {name:'Silver',hex:'#c0c0c0',multiplier:0.01,tolerance:10},
    {name:'No band',hex:'transparent',tolerance:20}
  ];
  const digitColours = colours.filter(c => Number.isInteger(c.digit));
  const multiplierColours = colours.filter(c => typeof c.multiplier === 'number');
  const toleranceColours = colours.filter(c => typeof c.tolerance === 'number');
  const toleranceText = value => value === 20 ? '±20% (no band)' : '±' + value + '%';
  const fmt = value => {
    const abs = Math.abs(value);
    if (abs >= 1e9) return (value / 1e9).toLocaleString('en-US',{maximumFractionDigits:3}) + ' GΩ';
    if (abs >= 1e6) return (value / 1e6).toLocaleString('en-US',{maximumFractionDigits:3}) + ' MΩ';
    if (abs >= 1e3) return (value / 1e3).toLocaleString('en-US',{maximumFractionDigits:3}) + ' kΩ';
    return value.toLocaleString('en-US',{maximumFractionDigits:3}) + ' Ω';
  };
  let currentBands = [];
  function makeSelect(id, label, options, selected) {
    const wrap = document.createElement('label');
    wrap.className = 'rc-band-field';
    wrap.htmlFor = id;
    wrap.append(document.createTextNode(label));
    const select = document.createElement('select');
    select.id = id;
    select.setAttribute('aria-label',label);
    options.forEach(item => {
      const option = document.createElement('option');
      option.value = item.name;
      option.textContent = item.name;
      option.style.backgroundColor = item.hex === 'transparent' ? '#eee' : item.hex;
      option.style.color = ['Black','Brown','Red','Blue','Violet','Grey'].includes(item.name) ? '#fff' : '#111';
      if (item.name === selected) option.selected = true;
      select.append(option);
    });
    select.addEventListener('change', update);
    wrap.append(select);
    return wrap;
  }
  function renderControls() {
    const count = Number($('band-count').value);
    const defaults = count === 4 ? ['Brown','Black','Red','Gold'] : ['Brown','Black','Black','Brown','Brown'];
    const labels = count === 4 ? ['Band 1 · First digit','Band 2 · Second digit','Band 3 · Multiplier','Band 4 · Tolerance'] : ['Band 1 · First digit','Band 2 · Second digit','Band 3 · Third digit','Band 4 · Multiplier','Band 5 · Tolerance'];
    currentBands = count === 4 ? ['digit','digit','multiplier','tolerance'] : ['digit','digit','digit','multiplier','tolerance'];
    const holder = $('band-controls');
    holder.replaceChildren();
    currentBands.forEach((type,index) => {
      let options = type === 'digit' ? digitColours : type === 'multiplier' ? multiplierColours : toleranceColours.filter(c => count === 4 || c.tolerance !== 20);
      if (index === 0) options = options.filter(c => c.name !== 'Black');
      holder.append(makeSelect('band-'+(index+1),labels[index],options,defaults[index]));
    });
    $('target-tolerance').value = count === 4 ? '5' : '1';
    $('target-tolerance').querySelectorAll('option').forEach(option => {
      option.disabled = count === 5 && option.value === '20';
    });
    update();
  }
  function selectedColour(index) {
    const select = $('band-'+(index+1));
    return colours.find(c => c.name === select.value);
  }
  function update() {
    const count = Number($('band-count').value);
    const selected = currentBands.map((_,i) => selectedColour(i));
    selected.forEach((colour,i) => {
      const band = $('preview-band-'+(i+1));
      band.style.display = 'block';
      band.style.background = colour.hex;
      band.style.boxShadow = colour.name === 'No band' ? 'none' : 'inset 1px 0 #fff4,inset -1px 0 #0003';
    });
    for (let i=selected.length+1;i<=5;i++) $('preview-band-'+i).style.display='none';
    const digits = selected.slice(0,count===4?2:3).reduce((n,c)=>n*10+c.digit,0);
    const multiplier = selected[count===4?2:3].multiplier;
    const tolerance = selected[count-1].tolerance;
    const nominal = digits * multiplier;
    const minimum = nominal * (1-tolerance/100);
    const maximum = nominal * (1+tolerance/100);
    $('nominal-result').textContent = fmt(nominal);
    $('minimum-result').textContent = fmt(minimum);
    $('maximum-result').textContent = fmt(maximum);
    $('tolerance-result').textContent = 'Tolerance: ' + toleranceText(tolerance) + ' (' + selected[count-1].name.toLowerCase() + ')';
    const meanings = count === 4
      ? ['first significant digit','second significant digit','multiplier','tolerance']
      : ['first significant digit','second significant digit','third significant digit','multiplier','tolerance'];
    $('band-meaning').innerHTML = meanings.map((meaning,i)=>'<li><b>Band '+(i+1)+':</b> '+meaning+'.</li>').join('');
  }
  function reverseLookup() {
    const target = Number($('target-resistance').value);
    const count = Number($('band-count').value);
    const tolerance = Number($('target-tolerance').value);
    const feedback = $('reverse-feedback');
    if (!Number.isFinite(target) || target <= 0) {
      feedback.textContent = 'Enter a resistance greater than zero ohms.';
      $('target-resistance').focus();
      return;
    }
    const toleranceBand = toleranceColours.find(c => c.tolerance === tolerance);
    if (!toleranceBand || (count === 5 && tolerance === 20)) {
      feedback.textContent = 'That tolerance is not available for this band count. Choose a supported tolerance.';
      return;
    }
    const digitCount = count === 4 ? 2 : 3;
    let best = null;
    const maxDigits = Math.pow(10,digitCount);
    multiplierColours.forEach(mult => {
      for(let digits=Math.pow(10,digitCount-1);digits<maxDigits;digits++) {
        const value = digits * mult.multiplier;
        const error = Math.abs(value-target)/target;
        if (!best || error < best.error) best = {digits,multiplier:mult,value,error,band:toleranceBand};
      }
    });
    const digitValues = String(best.digits).split('').map(Number);
    const digitBands = digitValues.map(d=>digitColours.find(c=>c.digit===d));
    const resultBands = [...digitBands,best.multiplier,best.band];
    resultBands.forEach((colour,i)=>$('band-'+(i+1)).value=colour.name);
    update();
    const exact = best.error < 0.0000001;
    feedback.textContent = (exact ? 'Exact colour-code match: ' : 'Closest standard colour-code match: ') + resultBands.map(c=>c.name).join(' · ') + ' = ' + fmt(best.value) + ' ' + toleranceText(tolerance) + (exact ? '.' : '. Difference from requested value: '+(best.error*100).toFixed(3)+'%.');
  }
  $('band-count').addEventListener('change',renderControls);
  $('reverse-lookup').addEventListener('click',reverseLookup);
  $('target-resistance').addEventListener('keydown',event=>{if(event.key==='Enter')reverseLookup();});
  $('reset-bands').addEventListener('click',renderControls);
  renderControls();
  const year=$('sl-year'); if(year) year.textContent=String(new Date().getFullYear());
})();