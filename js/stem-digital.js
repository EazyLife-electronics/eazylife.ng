/* Module 16: UART frame-time estimator */
(() => {
  const baud = document.getElementById('di-baud');
  const bytes = document.getElementById('di-bytes');
  const bits = document.getElementById('di-bits');
  const timeOut = document.getElementById('di-time');
  const throughputOut = document.getElementById('di-throughput');
  const note = document.getElementById('di-note');
  if (!baud || !bytes || !bits || !timeOut || !throughputOut || !note) return;

  const formatTime = seconds => {
    if (seconds < 1) return (seconds * 1000).toFixed(2) + ' ms';
    if (seconds < 60) return seconds.toFixed(3) + ' s';
    return (seconds / 60).toFixed(2) + ' min';
  };

  function update() {
    const rate = Number(baud.value);
    const count = Number(bytes.value);
    const frameBits = Number(bits.value);
    if (!Number.isFinite(rate) || rate <= 0 || !Number.isInteger(count) || count < 1 || count > 100000 || !Number.isFinite(frameBits)) {
      timeOut.textContent = 'Check inputs';
      throughputOut.textContent = '—';
      note.textContent = 'Enter a valid baud rate and a whole number of characters from 1 to 100,000.';
      return;
    }
    const totalBits = count * frameBits;
    const seconds = totalBits / rate;
    timeOut.textContent = formatTime(seconds);
    throughputOut.textContent = Math.floor(rate / frameBits).toLocaleString() + ' bytes/s';
    note.textContent = 'Ideal continuous transmission estimate: ' + totalBits.toLocaleString() + ' bits. Excludes software delays, inter-message gaps and processing time.';
  }
  [baud, bytes, bits].forEach(el => el.addEventListener('input', update));
  update();
})();
