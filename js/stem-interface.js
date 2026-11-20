(() => {
  'use strict';
  const digitSelect=document.getElementById('int-digit');
  const commonSelect=document.getElementById('int-common');
  const segmentPaths=[...document.querySelectorAll('#int-segments [data-seg]')];
  const patternOut=document.getElementById('int-pattern');
  const listOut=document.getElementById('int-segment-list');
  const noteOut=document.getElementById('int-mode-note');
  const patterns={
    0:['a','b','c','d','e','f'],1:['b','c'],2:['a','b','d','e','g'],
    3:['a','b','c','d','g'],4:['b','c','f','g'],5:['a','c','d','f','g'],
    6:['a','c','d','e','f','g'],7:['a','b','c'],8:['a','b','c','d','e','f','g'],
    9:['a','b','c','d','f','g']
  };
  const hex={0:'3F',1:'06',2:'5B',3:'4F',4:'66',5:'6D',6:'7D',7:'07',8:'7F',9:'6F'};
  function drawDigit(){
    if(!digitSelect||!commonSelect)return;
    const d=digitSelect.value, active=patterns[d]||[];
    segmentPaths.forEach(path=>path.classList.toggle('on',active.includes(path.dataset.seg)));
    if(patternOut)patternOut.textContent='0x'+hex[d];
    if(listOut)listOut.textContent=active.length?active.join(', '):'none';
    if(noteOut)noteOut.textContent=commonSelect.value==='cc'?'HIGH turns a segment ON in this common-cathode convention.':'LOW turns a segment ON in this common-anode convention; segment pattern is logically inverted at the driver.';
  }
  digitSelect?.addEventListener('change',drawDigit);
  commonSelect?.addEventListener('change',drawDigit);
  drawDigit();

  const keypad=document.getElementById('int-keypad');
  const line1=document.getElementById('int-lcd-line1');
  const line2=document.getElementById('int-lcd-line2');
  const status=document.getElementById('int-console-status');
  const back=document.getElementById('int-backspace');
  const clear=document.getElementById('int-clear');
  const send=document.getElementById('int-send');
  if(!keypad||!line1||!line2||!status||!back||!clear||!send)return;
  let entry='';
  function render(message){
    line1.textContent='INPUT: '+(entry||'');
    line2.textContent=message||'Press a key...';
    status.textContent=entry.length+' / 16 characters entered.';
  }
  keypad.addEventListener('click',event=>{
    const button=event.target.closest('button[data-key]');
    if(!button)return;
    if(entry.length>=16){status.textContent='Display input is full. Clear or send the message first.';return;}
    entry+=button.dataset.key;
    render('Input received');
  });
  back.addEventListener('click',()=>{entry=entry.slice(0,-1);render('Last character removed');});
  clear.addEventListener('click',()=>{entry='';line1.textContent='EazyLife STEM';line2.textContent='Press a key...';status.textContent='Input cleared.';});
  send.addEventListener('click',()=>{
    if(!entry){line2.textContent='Nothing to send';status.textContent='Enter at least one character first.';return;}
    const message=entry;
    line1.textContent='MESSAGE SENT';
    line2.textContent=message.slice(0,16);
    status.textContent='Teaching demo: message "'+message+'" submitted to the simulated interface.';
    entry='';
  });
  line1.textContent='EazyLife STEM';
  line2.textContent='Press a key...';
})();
