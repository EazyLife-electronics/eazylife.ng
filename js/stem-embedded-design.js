/* Module 18: task execution and deadline estimator */
(() => {
  const period = document.getElementById('ed-period');
  const execution = document.getElementById('ed-execution');
  const util = document.getElementById('ed-util');
  const slack = document.getElementById('ed-slack');
  const status = document.getElementById('ed-status');
  const note = document.getElementById('ed-note');
  if (!period || !execution || !util || !slack || !status || !note) return;

  function update() {
    const p = Number(period.value);
    const e = Number(execution.value);
    if (!Number.isFinite(p) || !Number.isFinite(e) || p <= 0 || e < 0 || p > 10000 || e > 10000) {
      util.textContent = '—';
      slack.textContent = '—';
      status.textContent = 'Check inputs';
      note.textContent = 'Enter a period greater than zero and a non-negative execution time, each no more than 10,000 ms.';
      return;
    }
    const remaining = p - e;
    util.textContent = (100 * e / p).toFixed(1) + '%';
    slack.textContent = remaining.toFixed(2) + ' ms';
    status.textContent = remaining >= 0 ? 'Within period' : 'Deadline exceeded';
    note.textContent = remaining >= 0
      ? 'This one task fits within its period in the ideal estimate. Other tasks, interrupts, blocking and scheduling overhead still need to be included.'
      : 'This task takes longer than its period. It cannot complete every release on time under this simple model.';
  }
  [period, execution].forEach(el => el.addEventListener('input', update));
  update();
  const year = document.getElementById('sl-year');
  if (year) year.textContent = new Date().getFullYear();
})();
