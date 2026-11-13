/* EazyLife STEM Lab — browser-only educational simulations. */
(() => {
  'use strict';
  const root = document;
  const $ = id => root.getElementById(id);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const explored = new Set();
  const stationNames = ['led', 'motor', 'sensor'];
  let activeStation = 'led';
  let ledPowered = true;
  let motorPowered = true;
  let challengeComplete = false;
  let sensorPulseTimer = null;

  function updateProgress() {
    const count = explored.size;
    const progress = $('stem-progress');
    if (progress) progress.style.width = (count / 3 * 100) + '%';
    const label = $('stem-progress-label');
    if (label) label.textContent = count + ' of 3 stations explored';
  }

  function markExplored(name) {
    explored.add(name);
    updateProgress();
  }

  function showStation(name) {
    if (!stationNames.includes(name)) return;
    activeStation = name;
    root.querySelectorAll('[data-station]').forEach(button => {
      const active = button.dataset.station === name;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    root.querySelectorAll('[data-panel]').forEach(panel => {
      const active = panel.dataset.panel === name;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
    markExplored(name);
  }

  root.querySelectorAll('[data-station]').forEach(button => {
    button.addEventListener('click', () => showStation(button.dataset.station));
  });

  // EXPERIMENT 01 — LED circuit using a simplified constant-forward-voltage model.
  function updateLed() {
    const voltage = Number($('led-voltage').value);
    const resistance = Number($('led-resistance').value);
    const currentMa = ledPowered ? Math.max(0, (voltage - 2) / resistance * 1000) : 0;
    const brightness = clamp(currentMa / 20 * 100, 0, 100);
    const conducting = currentMa > 0;

    $('led-voltage-value').textContent = voltage.toFixed(1) + ' V';
    $('led-resistance-value').textContent = resistance.toLocaleString() + ' Ω';
    $('led-current').innerHTML = currentMa.toFixed(1) + ' <small>mA</small>';
    $('led-drop').innerHTML = (conducting ? 2 : 0).toFixed(1) + ' <small>V</small>';
    $('led-brightness').innerHTML = Math.round(brightness) + ' <small>%</small>';
    $('led-state').textContent = conducting ? 'POWER ON' : 'NO CURRENT';

    const lamp = $('led-lamp');
    lamp.querySelector('.lamp-body').style.fill = conducting ? '#facc15' : '#475569';
    lamp.querySelector('.lamp-halo').style.opacity = String(brightness / 100 * .9);
    lamp.querySelector('.lamp-ray').style.opacity = String(brightness / 100);
    $('led-wire-live').style.opacity = conducting ? '1' : '0';
    $('led-power').textContent = ledPowered ? 'Switch power off' : 'Switch power on';

    let explanation;
    if (!ledPowered) explanation = 'The switch is open. No current flows around the circuit, so the LED is off.';
    else if (voltage <= 2) explanation = 'The supply voltage is not greater than the LED forward voltage. There is no current in this simplified model.';
    else if (currentMa > 20) explanation = 'The current is above 20 mA, which may exceed the rating of many small indicator LEDs. Increase the resistance to protect the LED.';
    else if (currentMa < 2) explanation = 'Only a small current flows. The LED may be very dim. Try reducing the resistor value carefully.';
    else explanation = 'The resistor limits current. With ' + voltage.toFixed(1) + ' V and ' + resistance + ' Ω, approximately ' + currentMa.toFixed(1) + ' mA flows through the LED.';
    $('led-explanation').textContent = explanation;
  }

  $('led-voltage').addEventListener('input', updateLed);
  $('led-resistance').addEventListener('input', updateLed);
  $('led-power').addEventListener('click', () => { ledPowered = !ledPowered; updateLed(); });
  $('led-reset').addEventListener('click', () => {
    $('led-voltage').value = '5';
    $('led-resistance').value = '300';
    ledPowered = true;
    updateLed();
  });

  // EXPERIMENT 02 — idealised brushed DC motor: speed proportional to average applied voltage.
  function updateMotor() {
    const duty = Number($('motor-pwm').value);
    const supply = Number($('motor-voltage').value);
    const averageVoltage = motorPowered ? duty / 100 * supply : 0;
    const rpm = Math.round(3000 * averageVoltage / 12);
    $('motor-pwm-value').textContent = duty + '%';
    $('motor-voltage-value').textContent = supply + ' V';
    $('motor-duty').innerHTML = (motorPowered ? duty : 0) + ' <small>%</small>';
    $('motor-rpm').innerHTML = rpm.toLocaleString() + ' <small>RPM</small>';
    $('motor-average').innerHTML = averageVoltage.toFixed(1) + ' <small>V</small>';
    $('motor-state').textContent = rpm > 0 ? 'RUNNING' : 'STOPPED';
    $('motor-power').textContent = motorPowered ? 'Stop motor' : 'Start motor';
    const rotor = $('motor-rotor');
    rotor.style.animationDuration = rpm > 0 ? (60 / rpm) + 's' : '1s';
    rotor.style.animationPlayState = rpm > 0 ? 'running' : 'paused';

    let explanation;
    if (!motorPowered) explanation = 'The motor is switched off. Start it again to explore how PWM and supply voltage affect speed.';
    else if (duty === 0) explanation = 'At 0% duty cycle, the driver never applies power. The motor is stopped.';
    else explanation = 'At ' + duty + '% duty cycle, the output is on for ' + duty + '% of each PWM period. The ideal average voltage is ' + averageVoltage.toFixed(1) + ' V, giving an estimated ' + rpm.toLocaleString() + ' RPM in this simplified model.';
    $('motor-explanation').textContent = explanation;
  }

  ['motor-pwm', 'motor-voltage'].forEach(id => $(id).addEventListener('input', updateMotor));
  $('motor-power').addEventListener('click', () => { motorPowered = !motorPowered; updateMotor(); });
  $('motor-reset').addEventListener('click', () => {
    $('motor-pwm').value = '60';
    $('motor-voltage').value = '12';
    motorPowered = true;
    updateMotor();
  });

  // EXPERIMENT 03 — time-of-flight model for a typical HC-SR04-style ultrasonic sensor.
  function updateSensor(announce) {
    const distance = Number($('sensor-range').value);
    const echoMicroseconds = Math.round(distance * 20000 / 343);
    const x = 165 + (distance - 2) / 398 * 350;
    $('sensor-range-value').textContent = distance + ' cm';
    $('sensor-distance').innerHTML = distance.toFixed(1) + ' <small>cm</small>';
    $('sensor-echo').innerHTML = echoMicroseconds.toLocaleString() + ' <small>µs</small>';
    $('sensor-svg-distance').textContent = distance + ' cm';
    $('sensor-object').setAttribute('transform', 'translate(' + x.toFixed(1) + ' 0)');
    $('sensor-object-label').setAttribute('x', x.toFixed(1));
    $('sensor-state').textContent = distance > 350 ? 'NEAR MAX RANGE' : 'READY';
    $('sensor-feedback').textContent = announce
      ? 'Echo received in ' + echoMicroseconds.toLocaleString() + ' µs. Calculated distance: ' + distance + ' cm.'
      : 'Ready to measure. Send an ultrasonic pulse.';
  }

  $('sensor-range').addEventListener('input', () => updateSensor(false));
  $('sensor-trigger').addEventListener('click', () => {
    if (sensorPulseTimer) window.clearTimeout(sensorPulseTimer);
    const button = $('sensor-trigger');
    const distance = Number($('sensor-range').value);
    const echoMicroseconds = Math.round(distance * 20000 / 343);
    $('sensor-state').textContent = 'TRANSMITTING…';
    $('sensor-feedback').textContent = 'Pulse sent. Waiting for the echo to return…';
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-wave-square"></i> Listening…';
    root.querySelectorAll('.sound-wave').forEach(wave => wave.style.animationDuration = '.25s');
    sensorPulseTimer = window.setTimeout(() => {
      updateSensor(true);
      $('sensor-state').textContent = 'ECHO RECEIVED';
      button.disabled = false;
      button.innerHTML = 'Send pulse <i class="fas fa-paper-plane"></i>';
      root.querySelectorAll('.sound-wave').forEach(wave => wave.style.animationDuration = '.8s');
    }, clamp(echoMicroseconds / 1000, 120, 900));
  });
  $('sensor-reset').addEventListener('click', () => {
    if (sensorPulseTimer) window.clearTimeout(sensorPulseTimer);
    $('sensor-range').value = '30';
    $('sensor-trigger').disabled = false;
    $('sensor-trigger').innerHTML = 'Send pulse <i class="fas fa-paper-plane"></i>';
    updateSensor(false);
  });

  // ONE-QUESTION KNOWLEDGE CHECK.
  root.querySelectorAll('[data-answer]').forEach(button => {
    button.addEventListener('click', () => {
      if (challengeComplete) return;
      const correct = button.dataset.answer === 'correct';
      root.querySelectorAll('[data-answer]').forEach(option => {
        option.disabled = true;
        if (option.dataset.answer === 'correct') option.classList.add('correct');
      });
      if (!correct) button.classList.add('wrong');
      $('challenge-feedback').textContent = correct
        ? 'Correct! R = (5 V − 2 V) ÷ 0.01 A = 300 Ω. Great engineering!'
        : 'Not quite. Use Ohm’s law: R = (5 − 2) ÷ 0.01. That gives 300 Ω. Try the LED experiment to see why.';
      challengeComplete = true;
    });
  });

  $('stem-year').textContent = new Date().getFullYear();
  updateLed();
  updateMotor();
  updateSensor(false);
  showStation('led');
})();