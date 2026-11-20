(() => {
  const gate = document.getElementById('logic-gate');
  const buttonA = document.getElementById('logic-a');
  const buttonB = document.getElementById('logic-b');
  const buttonBWrap = document.getElementById('logic-b-wrap');
  const output = document.getElementById('logic-output');
  const explanation = document.getElementById('logic-explanation');
  const table = document.getElementById('logic-live-table');
  if (!gate || !buttonA || !buttonB || !output || !explanation || !table) return;

  let a = 0;
  let b = 0;
  const calculate = (name, x, y) => {
    switch (name) {
      case 'AND': return x & y;
      case 'OR': return x | y;
      case 'NOT': return x ? 0 : 1;
      case 'NAND': return (x & y) ? 0 : 1;
      case 'NOR': return (x | y) ? 0 : 1;
      case 'XOR': return x ^ y;
      case 'XNOR': return x === y ? 1 : 0;
      default: return 0;
    }
  };
  const render = () => {
    const name = gate.value;
    const y = calculate(name, a, b);
    buttonA.textContent = a ? 'HIGH · 1' : 'LOW · 0';
    buttonB.textContent = b ? 'HIGH · 1' : 'LOW · 0';
    buttonA.setAttribute('aria-pressed', String(Boolean(a)));
    buttonB.setAttribute('aria-pressed', String(Boolean(b)));
    buttonBWrap.hidden = name === 'NOT';
    output.textContent = y ? '1 · HIGH' : '0 · LOW';
    const messages = {
      AND: 'AND is HIGH only when A and B are both HIGH.',
      OR: 'OR is HIGH when at least one input is HIGH.',
      NOT: 'NOT reverses input A. Input B is not used.',
      NAND: 'NAND is the inverse of AND. It is LOW only when both inputs are HIGH.',
      NOR: 'NOR is the inverse of OR. It is HIGH only when both inputs are LOW.',
      XOR: 'XOR is HIGH when the two input states are different.',
      XNOR: 'XNOR is HIGH when the two input states are the same.'
    };
    explanation.textContent = messages[name] + ' Current output: ' + y + '.';
    table.querySelectorAll('tbody tr').forEach(row => {
      const rowA = Number(row.dataset.a);
      const rowB = Number(row.dataset.b);
      row.hidden = name === 'NOT' && rowB === 1;
      row.classList.toggle('active', rowA === a && (name === 'NOT' ? rowB === 0 : rowB === b));
      row.cells[2].textContent = String(calculate(name, rowA, rowB));
    });
    if (name === 'NOT') {
      table.querySelector('thead').innerHTML = '<tr><th>A</th><th>Y</th></tr>';
      table.querySelectorAll('tbody tr').forEach(row => {
        row.cells[1].hidden = true;
        row.cells[2].hidden = false;
        row.cells[2].textContent = String(calculate('NOT', Number(row.dataset.a), 0));
      });
    } else {
      table.querySelector('thead').innerHTML = '<tr><th>A</th><th>B</th><th>Y</th></tr>';
      table.querySelectorAll('tbody tr').forEach(row => {
        row.cells[1].hidden = false;
        row.cells[2].hidden = false;
      });
    }
  };
  buttonA.addEventListener('click', () => { a = a ? 0 : 1; render(); });
  buttonB.addEventListener('click', () => { b = b ? 0 : 1; render(); });
  gate.addEventListener('change', render);
  render();
})();