(() => {
  const selector = document.getElementById('combo-function');
  const buttonA = document.getElementById('combo-a');
  const buttonB = document.getElementById('combo-b');
  const output = document.getElementById('combo-y');
  const explanation = document.getElementById('combo-explanation');
  const table = document.getElementById('combo-table');
  if (!selector || !buttonA || !buttonB || !output || !explanation || !table) return;

  let a = 0;
  let b = 0;
  const evaluate = (name, x, y) => {
    switch (name) {
      case 'and': return x & y;
      case 'or': return x | y;
      case 'xor': return x ^ y;
      case 'nand': return (x & y) ? 0 : 1;
      case 'nor': return (x | y) ? 0 : 1;
      case 'xnor': return x === y ? 1 : 0;
      case 'mux': return x ? y : 0;
      default: return 0;
    }
  };
  const descriptions = {
    and: 'AND is HIGH only when both inputs are HIGH.',
    or: 'OR is HIGH when at least one input is HIGH.',
    xor: 'XOR is HIGH when the inputs are different.',
    nand: 'NAND is the inverse of AND; it is LOW only when both inputs are HIGH.',
    nor: 'NOR is the inverse of OR; it is HIGH only when both inputs are LOW.',
    xnor: 'XNOR is HIGH when both inputs have the same state.',
    mux: 'A is the select input. When A=0, output is D0=0; when A=1, output follows B (D1).'
  };
  const render = () => {
    const name = selector.value;
    const result = evaluate(name, a, b);
    buttonA.textContent = a ? 'HIGH · 1' : 'LOW · 0';
    buttonB.textContent = b ? 'HIGH · 1' : 'LOW · 0';
    buttonA.setAttribute('aria-pressed', String(Boolean(a)));
    buttonB.setAttribute('aria-pressed', String(Boolean(b)));
    output.textContent = result ? '1 · HIGH' : '0 · LOW';
    explanation.textContent = descriptions[name] + ' Current output: ' + result + '.';
    table.querySelectorAll('tbody tr').forEach(row => {
      const x = Number(row.dataset.a);
      const y = Number(row.dataset.b);
      row.cells[2].textContent = String(evaluate(name, x, y));
      row.classList.toggle('active', x === a && y === b);
    });
  };
  buttonA.addEventListener('click', () => { a = a ? 0 : 1; render(); });
  buttonB.addEventListener('click', () => { b = b ? 0 : 1; render(); });
  selector.addEventListener('change', render);
  render();
})();
