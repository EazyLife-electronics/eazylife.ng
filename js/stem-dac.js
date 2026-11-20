(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const num = (id, fallback) => {
    const v = Number($(id)?.value);
    return Number.isFinite(v) ? v : fallback;
  };
  const fmt = (v, digits=3) => Number(v).toFixed(digits);
  function updateResolution(){
    const bits=clamp(Math.round(num('dac-bits',8)),1,16), levels=2**bits, max=levels-1;
    const ref=clamp(num('dac-vref',3.3),0.1,24), code=clamp(Math.round(num('dac-code',128)),0,max);
    $('dac-code').max=max; $('dac-code').value=code;
    const step=ref/levels, voltage=step*code;
    $('dac-code-out').textContent=code+' / '+max;
    $('dac-voltage').textContent=fmt(voltage,3)+' V';
    $('dac-step').textContent=step>=0.01?fmt(step*1000,2)+' mV':fmt(step*1000000,1)+' µV';
    $('dac-levels').textContent=levels.toLocaleString();
    $('dac-level-fill').style.width=(code/max*100)+'%';
    $('dac-resolution-note').textContent=bits+'-bit resolution provides '+levels.toLocaleString()+' codes. This ideal model maps code 0 to 0 V and code '+max+' to '+fmt(ref,2)+' V.';
  }
  ['dac-bits','dac-vref','dac-code'].forEach(id=>$(id)?.addEventListener('input',updateResolution));
  function updateLadder(){
    const code=clamp(Math.round(num('dac-ladder-code',15)),0,15), vcc=clamp(num('dac-ladder-vcc',5),1,5.5);
    $('dac-ladder-binary').textContent=code.toString(2).padStart(4,'0');
    $('dac-ladder-output').textContent=fmt(vcc*code/16,3)+' V';
    $('dac-ladder-step').textContent=fmt(vcc/16,3)+' V';
  }
  ['dac-ladder-code','dac-ladder-vcc'].forEach(id=>$(id)?.addEventListener('input',updateLadder));
  function updatePwm(){
    const duty=clamp(num('dac-duty',50),0,100), v=clamp(num('dac-pwm-v',5),1,12);
    const r=clamp(num('dac-filter-r',10),0.1,1000)*1000, c=clamp(num('dac-filter-c',10),0.001,1000)*1e-6;
    const tau=r*c, cutoff=1/(2*Math.PI*tau);
    $('dac-pwm-average').textContent=fmt(v*duty/100,3)+' V';
    $('dac-pwm-tau').textContent=tau>=1?fmt(tau,2)+' s':fmt(tau*1000,2)+' ms';
    $('dac-pwm-cutoff').textContent=cutoff>=1000?fmt(cutoff/1000,2)+' kHz':fmt(cutoff,2)+' Hz';
  }
  ['dac-duty','dac-pwm-v','dac-filter-r','dac-filter-c'].forEach(id=>$(id)?.addEventListener('input',updatePwm));
  function waveform(type, phase){
    if(type==='square') return phase<0.5?1:-1;
    if(type==='triangle') return 1-4*Math.abs(phase-0.5);
    if(type==='saw') return 2*phase-1;
    return Math.sin(2*Math.PI*phase);
  }
  function updateWave(){
    const type=$('dac-wave').value, freq=clamp(num('dac-frequency',10),0.1,10000);
    const amp=clamp(num('dac-amplitude',1),0,5), offset=clamp(num('dac-offset',1.65),0,5);
    const samples=clamp(Math.round(num('dac-samples',64)),8,512), ref=clamp(num('dac-wave-vref',3.3),0.1,5.5);
    const min=offset-amp,max=offset+amp, safeMin=clamp(min,0,ref),safeMax=clamp(max,0,ref);
    const x0=45,x1=690,y0=20,y1=210, span=Math.max(ref,0.1);
    const pts=[];
    for(let i=0;i<=samples;i++){
      const p=i/samples, raw=offset+amp*waveform(type,p), voltage=clamp(raw,0,ref);
      const x=x0+(x1-x0)*p, y=y1-(voltage/span)*(y1-y0);
      pts.push((i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2));
    }
    $('dac-wave-path').setAttribute('d',pts.join(' '));
    const midY=y1-(clamp(offset,0,ref)/span)*(y1-y0);
    $('dac-wave-mid').setAttribute('d','M'+x0+' '+midY+'H'+x1);
    $('dac-wave-min').textContent='0 V'; $('dac-wave-max').textContent=fmt(ref,2)+' V';
    $('dac-required-rate').textContent=(freq*samples).toLocaleString(undefined,{maximumFractionDigits:1})+' samples/s';
    $('dac-wave-range').textContent=fmt(safeMin,2)+'–'+fmt(safeMax,2)+' V';
    $('dac-wave-quant').textContent=fmt(ref/256*1000,2)+' mV / step (8-bit example)';
    let warning='Ideal sampled waveform display. Real output quality depends on DAC settling, sample timing, reconstruction filtering, reference stability and load.';
    if(min<0||max>ref) warning+=' Requested waveform exceeds the unipolar 0–VREF range and is clipped in this display.';
    if(freq*samples>100000) warning+=' This sample rate may be impractical for a simple microcontroller loop; use hardware timing/DMA and check the device limits.';
    $('dac-wave-warning').textContent=warning;
  }
  ['dac-wave','dac-frequency','dac-amplitude','dac-offset','dac-samples','dac-wave-vref'].forEach(id=>$(id)?.addEventListener('input',updateWave));
  updateResolution(); updateLadder(); updatePwm(); updateWave();
})();