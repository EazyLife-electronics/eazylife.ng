/* Module 19: client-side teaching calculators */
(() => {
  const duty = document.getElementById('mc-duty');
  const dutyPct = document.getElementById('mc-duty-pct');
  const dutyV = document.getElementById('mc-duty-v');
  const disturbance = document.getElementById('mc-disturbance');
  const correction = document.getElementById('mc-correction');
  const openLoss = document.getElementById('mc-open-loss');
  const closedLoss = document.getElementById('mc-closed-loss');

  function updateDuty() {
    if (!duty || !dutyPct || !dutyV) return;
    const raw = Number(duty.value);
    if (!Number.isFinite(raw) || raw < 0 || raw > 255) {
      dutyPct.textContent = 'Check 0–255';
      dutyV.textContent = '—';
      return;
    }
    const value = Math.round(raw);
    const ratio = value / 255;
    dutyPct.textContent = (ratio * 100).toFixed(1) + '%';
    dutyV.textContent = (ratio * 6).toFixed(2) + ' V';
  }

  function updateFeedback() {
    if (!disturbance || !correction || !openLoss || !closedLoss) return;
    const d = Number(disturbance.value);
    const c = Number(correction.value);
    if (!Number.isFinite(d) || !Number.isFinite(c) || d < 0 || d > 70 || c < 0 || c > 100) return;
    openLoss.textContent = d.toFixed(0) + '%';
    closedLoss.textContent = (d * (1 - c / 100)).toFixed(1) + '%';
  }

  if (duty) duty.addEventListener('input', updateDuty);
  if (disturbance) disturbance.addEventListener('input', updateFeedback);
  if (correction) correction.addEventListener('input', updateFeedback);
  updateDuty();
  updateFeedback();
})();
