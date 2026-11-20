/* Module 20: differential-drive kinematics teaching calculator */
(() => {
  const ids = ['rb-wheel', 'rb-track', 'rb-left', 'rb-right'];
  const nodes = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
  const linear = document.getElementById('rb-linear');
  const yaw = document.getElementById('rb-yaw');
  const radius = document.getElementById('rb-radius');
  const motion = document.getElementById('rb-motion');
  const warning = document.getElementById('rb-warning');

  function calculate() {
    if (ids.some(id => !nodes[id]) || !linear || !yaw || !radius || !motion || !warning) return;
    const [diameter, track, leftRpm, rightRpm] = ids.map(id => Number(nodes[id].value));
    if (![diameter, track, leftRpm, rightRpm].every(Number.isFinite) ||
        diameter <= 0 || track <= 0 || Math.abs(leftRpm) > 1000 || Math.abs(rightRpm) > 1000) {
      linear.textContent = 'Check inputs';
      yaw.textContent = '—';
      radius.textContent = '—';
      motion.textContent = 'Invalid values';
      warning.textContent = 'Enter positive wheel diameter and track width; wheel speeds must be between −1000 and +1000 RPM.';
      return;
    }
    const circumferenceM = Math.PI * diameter / 1000;
    const vL = leftRpm * circumferenceM / 60;
    const vR = rightRpm * circumferenceM / 60;
    const v = (vL + vR) / 2;
    const omega = (vR - vL) / (track / 1000);
    const radiusM = Math.abs(omega) < 1e-9 ? Infinity : v / omega;
    linear.textContent = (v * 100).toFixed(2) + ' cm/s';
    yaw.textContent = (omega * 180 / Math.PI).toFixed(2) + ' °/s';
    radius.textContent = Number.isFinite(radiusM) ? (radiusM * 100).toFixed(2) + ' cm' : 'Straight';
    if (Math.abs(omega) < 1e-9) {
      motion.textContent = Math.abs(v) < 1e-9 ? 'Stationary' : (v > 0 ? 'Straight ahead' : 'Straight reverse');
    } else if (Math.abs(v) < 1e-9) {
      motion.textContent = 'Turns on the spot';
    } else {
      motion.textContent = (omega > 0 ? 'Turns left' : 'Turns right') + (v < 0 ? ' while reversing' : '');
    }
    warning.textContent = 'Ideal no-slip model. Real motion differs due to traction, wheel mismatch, motor response, load, backlash and caster drag.';
  }

  ids.forEach(id => nodes[id]?.addEventListener('input', calculate));
  calculate();
})();
