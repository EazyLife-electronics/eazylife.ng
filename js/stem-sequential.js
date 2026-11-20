(() => {
  'use strict';
  const type = document.getElementById('seq-type');
  const controls = document.getElementById('seq-controls');
  const clock = document.getElementById('seq-clock');
  const reset = document.getElementById('seq-reset');
  const qOut = document.getElementById('seq-q');
  const qbarOut = document.getElementById('seq-qbar');
  const feedback = document.getElementById('seq-feedback');
  const truth = document.querySelector('#seq-truth tbody');
  if (!type || !controls || !clock || !reset || !qOut || !qbarOut || !feedback || !truth) return;

  let q = 0;
  const inputOptions = {
    d: [['D', 'seq-d']],
    jk: [['J', 'seq-j'], ['K', 'seq-k']],
    t: [['T', 'seq-t']],
    sr: [['S', 'seq-s'], ['R', 'seq-r']]
  };
  const inputLabels = {d:'D',jk:'J and K',t:'T',sr:'S and R'};
  const get = id => Number(document.getElementById(id)?.value || 0);
  function buildControls() {
    controls.innerHTML = inputOptions[type.value].map(([label,id]) =>
      '<div class="seq-control"><label for="' + id + '">' + label + ' input</label><select id="' + id + '"><option value="0">0 · LOW</option><option value="1">1 · HIGH</option></select></div>'
    ).join('');
    renderTruth();
    feedback.textContent = 'Current Q=' + q + '. Set ' + inputLabels[type.value] + ', then apply a rising clock edge.';
  }
  function nextState(kind, state, values) {
    if (kind === 'd') return values.d;
    if (kind === 'jk') {
      if (values.j === 0 && values.k === 0) return state;
      if (values.j === 0 && values.k === 1) return 0;
      if (values.j === 1 && values.k === 0) return 1;
      return state ? 0 : 1;
    }
    if (kind === 't') return values.t ? (state ? 0 : 1) : state;
    if (values.s && values.r) return null;
    if (values.s) return 1;
    if (values.r) return 0;
    return state;
  }
  function readInputs() {
    if (type.value === 'd') return {d:get('seq-d')};
    if (type.value === 'jk') return {j:get('seq-j'),k:get('seq-k')};
    if (type.value === 't') return {t:get('seq-t')};
    return {s:get('seq-s'),r:get('seq-r')};
  }
  function renderTruth() {
    const kind = type.value;
    const cases = kind === 'd' ? [{d:0},{d:1}]
      : kind === 'jk' ? [{j:0,k:0},{j:0,k:1},{j:1,k:0},{j:1,k:1}]
      : kind === 't' ? [{t:0},{t:1}]
      : [{s:0,r:0},{s:0,r:1},{s:1,r:0},{s:1,r:1}];
    truth.innerHTML = cases.map(v => {
      const label = Object.entries(v).map(([k,n]) => k.toUpperCase()+'='+n).join(', ');
      const n0 = nextState(kind,0,v);
      const n1 = nextState(kind,1,v);
      return '<tr><td>'+label+'</td><td>'+(n0===null?'Invalid':n0)+'</td><td>'+(n1===null?'Invalid':n1)+'</td></tr>';
    }).join('');
  }
  function renderState() {
    qOut.textContent = String(q);
    qbarOut.textContent = String(q ? 0 : 1);
  }
  type.addEventListener('change', buildControls);
  clock.addEventListener('click', () => {
    const values = readInputs();
    const next = nextState(type.value,q,values);
    if (next === null) {
      feedback.textContent = 'Invalid SR combination: S and R are both HIGH in this active-HIGH model. Q is not updated.';
      return;
    }
    const before=q; q=next; renderState();
    feedback.textContent = 'Rising edge applied. ' + Object.entries(values).map(([k,v])=>k.toUpperCase()+'='+v).join(', ') + ': Q changed from '+before+' to '+q+'.';
  });
  reset.addEventListener('click', () => { q=0; renderState(); feedback.textContent='Teaching model reset: Q=0 and Q̅=1.'; });
  buildControls(); renderState();

  const countButton=document.getElementById('seq-count-clock');
  const countReset=document.getElementById('seq-count-reset');
  const countOut=document.getElementById('seq-count');
  const binaryOut=document.getElementById('seq-binary');
  const led1=document.getElementById('seq-led1');
  const led0=document.getElementById('seq-led0');
  const countFeedback=document.getElementById('seq-count-feedback');
  if(!countButton||!countReset||!countOut||!binaryOut||!led1||!led0||!countFeedback)return;
  let count=0;
  function renderCounter(){
    const bits=count.toString(2).padStart(2,'0');
    countOut.textContent=String(count);
    binaryOut.textContent=bits;
    led1.classList.toggle('on',bits[0]==='1');
    led0.classList.toggle('on',bits[1]==='1');
    led1.setAttribute('aria-label','Q1 '+(bits[0]==='1'?'HIGH':'LOW'));
    led0.setAttribute('aria-label','Q0 '+(bits[1]==='1'?'HIGH':'LOW'));
  }
  countButton.addEventListener('click',()=>{count=(count+1)%4;renderCounter();countFeedback.textContent='Clock edge applied. Counter state is '+count.toString(2).padStart(2,'0')+' ('+count+').';});
  countReset.addEventListener('click',()=>{count=0;renderCounter();countFeedback.textContent='Counter reset to 00.';});
  renderCounter();
})();
