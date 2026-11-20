/* Module 21: sensor-fusion and stopping-distance teaching calculators */
(() => {
  const byId = id => document.getElementById(id);
  const fusionIds = ['au-a','au-wa','au-b','au-wb'];
  const fusionNodes = fusionIds.map(byId);
  const estimate = byId('au-estimate'), difference = byId('au-difference');
  const total = byId('au-total'), status = byId('au-status');
  function fusion() {
    if (fusionNodes.some(n => !n) || !estimate || !difference || !total || !status) return;
    const [a, wa, b, wb] = fusionNodes.map(n => Number(n.value));
    if (![a,wa,b,wb].every(Number.isFinite) || a <= 0 || b <= 0 || wa < 0 || wb < 0 || a > 500 || b > 500 || wa > 100 || wb > 100 || wa + wb <= 0) {
      estimate.textContent = 'Check inputs'; difference.textContent = '—'; total.textContent = '—';
      status.textContent = 'Distances must be 1–500 cm; weights must be 0–100 and have a positive total.';
      return;
    }
    const sum = wa + wb;
    estimate.textContent = ((a * wa + b * wb) / sum).toFixed(2) + ' cm';
    difference.textContent = Math.abs(a-b).toFixed(2) + ' cm';
    total.textContent = sum.toFixed(2);
    status.textContent = Math.abs(a-b) > 20 ? 'Large disagreement: do not trust the blended estimate without investigating target, timing and sensor faults.' : 'Illustrative weighted average only. Check that both sensors observe the same target at nearly the same time.';
  }
  fusionNodes.forEach(n => n?.addEventListener('input', fusion));
  fusion();

  const stopIds = ['au-speed','au-decel','au-latency','au-margin'];
  const stopNodes = stopIds.map(byId);
  const brake = byId('au-brake'), latencyDistance = byId('au-latency-distance');
  const totalDistance = byId('au-total-distance'), stopStatus = byId('au-stop-status');
  function stopping() {
    if (stopNodes.some(n => !n) || !brake || !latencyDistance || !totalDistance || !stopStatus) return;
    const [v, decel, latencyMs, marginCm] = stopNodes.map(n => Number(n.value));
    if (![v,decel,latencyMs,marginCm].every(Number.isFinite) || v < 0 || v > 5 || decel <= 0 || decel > 10 || latencyMs < 0 || latencyMs > 2000 || marginCm < 0 || marginCm > 500) {
      brake.textContent = 'Check inputs'; latencyDistance.textContent = '—'; totalDistance.textContent = '—';
      stopStatus.textContent = 'Use speed 0–5 m/s, deceleration above 0 and at most 10 m/s², latency 0–2000 ms and margin 0–500 cm.';
      return;
    }
    const brakingM = v*v/(2*decel), reactionM = v*latencyMs/1000;
    brake.textContent = (brakingM*100).toFixed(2) + ' cm';
    latencyDistance.textContent = (reactionM*100).toFixed(2) + ' cm';
    totalDistance.textContent = ((brakingM+reactionM)*100+marginCm).toFixed(2) + ' cm';
    stopStatus.textContent = 'Ideal constant-deceleration estimate only. Real stopping distance varies with surface, load, battery, tyres, driver behaviour and control delays.';
  }
  stopNodes.forEach(n => n?.addEventListener('input', stopping));
  stopping();
})();
