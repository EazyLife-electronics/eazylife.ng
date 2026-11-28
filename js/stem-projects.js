/* EazyLife Arduino project playground — simplified interactive models. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  const timers = new Map();
  const later = (key, fn, ms) => {
    if (timers.has(key)) clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => { timers.delete(key); fn(); }, ms));
  };
  const cancel = key => { if (timers.has(key)) clearTimeout(timers.get(key)); timers.delete(key); };

  // Project category filters.
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b === button));
    const filter = button.dataset.filter;
    document.querySelectorAll('.sp-project').forEach(card => { card.hidden = filter !== 'all' && card.dataset.category !== filter; });
  }));

  // 01 — PIR motion detector, retriggerable hold timer.
  let pirActive = false;
  function pirOff() {
    pirActive = false;
    $('pir-person').classList.remove('moving');
    $('pir-person').style.left = '15%';
    $('pir-lamp').classList.remove('on');
    $('pir-buzzer').classList.remove('on');
    setText('pir-status', 'AREA CLEAR · SENSOR IDLE');
    setText('pir-output', 'LOW · NO MOTION');
    setText('pir-load', 'OFF');
    setText('pir-explain', 'The person has stopped moving and the hold time has elapsed. PIR output returns LOW, so the LED and buzzer switch off.');
  }
  function pirMotion() {
    pirActive = true;
    const person = $('pir-person');
    person.style.left = person.style.left === '15%' ? '36%' : '15%';
    person.classList.add('moving');
    $('pir-lamp').classList.add('on');
    $('pir-buzzer').classList.add('on');
    setText('pir-status', 'MOTION DETECTED · OUTPUT ACTIVE');
    setText('pir-output', 'HIGH · MOTION');
    setText('pir-load', 'LED ON · BUZZER ON');
    setText('pir-explain', 'Movement changed the infrared pattern. The PIR output is HIGH; the LED and buzzer stay on for the selected hold time after the last movement.');
    const seconds = Number($('pir-hold').value);
    setText('pir-hold-value', seconds + ' seconds');
    later('pir', pirOff, seconds * 1000);
  }
  $('pir-move').addEventListener('click', pirMotion);
  $('pir-hold').addEventListener('input', () => { const n = Number($('pir-hold').value); setText('pir-hold-value', n + ' seconds'); if (pirActive) later('pir', pirOff, n * 1000); });
  $('pir-reset').addEventListener('click', () => { cancel('pir'); pirOff(); $('pir-hold').value = 5; setText('pir-hold-value', '5 seconds'); });

  // 02 — digital input to digital output.
  function digitalUpdate(pressed) {
    setText('digital-read', pressed ? 'HIGH · 1' : 'LOW · 0');
    setText('digital-write', pressed ? 'HIGH · 1' : 'LOW · 0');
    setText('digital-button-state', pressed ? 'PRESSED' : 'RELEASED');
    setText('digital-output-state', pressed ? 'LED ON' : 'LED OFF');
    $('digital-led').classList.toggle('on', pressed);
  }
  $('digital-button').addEventListener('click', () => digitalUpdate(true));
  $('digital-release').addEventListener('click', () => digitalUpdate(false));

  // 03 — analogRead and PWM analogWrite model.
  function analogUpdate() {
    const p = Number($('pot-value').value);
    const raw = Math.round(p * 1023 / 100);
    const pwm = Math.round(raw * 255 / 1023);
    setText('pot-position', p + '%');
    setText('pot-raw', String(raw));
    setText('pot-pwm', pwm + ' / 255');
    setText('pot-brightness', p + '%');
    $('pot-knob').style.transform = 'rotate(' + (p * 2.7 - 135) + 'deg)';
    $('analog-led').style.opacity = String(.22 + p / 100 * .78);
    $('analog-led').classList.toggle('on', p > 0);
  }
  $('pot-value').addEventListener('input', analogUpdate);

  // 04 — flame sensor threshold.
  function fireUpdate() {
    const v = Number($('flame-level').value);
    const active = v >= 45;
    setText('flame-level-value', v + '%');
    setText('flame-reading', active ? 'HIGH · FLAME SIGNAL' : 'LOW · CLEAR');
    setText('fire-alarm-state', active ? 'ON · ALERT' : 'OFF');
    setText('fire-status', active ? 'FLAME SIGNAL DETECTED · ALARM' : 'NO FLAME DETECTED');
    $('flame-graphic').classList.toggle('active', v > 0);
    $('flame-graphic').style.opacity = String(.25 + v / 100 * .75);
    $('fire-beacon').classList.toggle('active', active);
    setText('fire-explain', active ? 'The infrared intensity has crossed the example threshold. The Arduino output activates the alarm. Lower the intensity to clear the alert.' : 'Below the example threshold, the sensor reports a clear condition. Raise the intensity to trigger the alarm.');
  }
  $('flame-level').addEventListener('input', fireUpdate);

  // 05 — MQ-2 conceptual gas threshold. ppm is illustrative, not calibrated.
  function gasUpdate() {
    const ppm = Number($('gas-level').value);
    const threshold = Number($('gas-threshold').value);
    const adc = Math.round((ppm - 100) / 1900 * 1023);
    const active = ppm >= threshold;
    setText('gas-level-value', ppm + ' ppm');
    setText('gas-threshold-value', threshold + ' ppm');
    setText('gas-adc', adc + ' / 1023');
    setText('gas-buzzer', active ? 'ON · ALERT' : 'OFF');
    setText('gas-status', active ? 'GAS LEVEL ABOVE SETPOINT' : 'AIR QUALITY NORMAL');
    setText('gas-gauge-label', active ? 'ALERT' : (ppm > 350 ? 'ELEVATED' : 'LOW'));
    $('gas-gauge-fill').style.width = clamp((ppm - 100) / 1900 * 100, 3, 100) + '%';
    $('gas-gauge-fill').style.background = active ? '#df5548' : '#55aa76';
    $('gas-cloud').style.opacity = String(.2 + ppm / 2000 * .8);
    $('gas-cloud').style.color = active ? '#8e9fa4' : '#c2d0d4';
    setText('gas-explain', active ? 'The illustrative sensor value has crossed the alarm setpoint, so the Arduino switches on the buzzer. Real MQ-2 modules require warm-up and calibration.' : 'The simulated reading is below the alarm threshold. Increase the gas level or lower the setpoint to test the alarm.');
  }
  ['gas-level','gas-threshold'].forEach(id => $(id).addEventListener('input', gasUpdate));

  // 06 — automatic pump with hysteresis. The user can set the tank level and thresholds.
  let pumpAuto = true, pumpOn = false;
  function pumpUpdate() {
    const level = Number($('tank-level').value);
    const low = Number($('pump-low').value);
    const high = Math.max(low + 5, Number($('pump-high').value));
    $('pump-high').min = String(Math.min(95, low + 5));
    if (pumpAuto) {
      if (level <= low) pumpOn = true;
      if (level >= high) pumpOn = false;
    }
    setText('tank-level-value', level + '%');
    setText('pump-low-value', low + '%');
    setText('pump-high-value', high + '%');
    setText('pump-output', pumpOn ? 'ON · FILLING' : 'OFF');
    setText('pump-status', pumpOn ? 'PUMP RUNNING · FILLING TANK' : 'TANK LEVEL OK · PUMP OFF');
    $('tank-water').style.height = level + '%';
    $('pump-unit').classList.toggle('on', pumpOn);
    $('pipe-flow').classList.toggle('on', pumpOn);
    setText('pump-explain', pumpAuto ? (pumpOn ? 'Level is at or below the low threshold. The pump is running. Move the tank level up to the upper stop point to switch it off.' : 'Automatic mode is monitoring the level. The pump starts at or below ' + low + '% and stops at ' + high + '%.') : 'Automatic mode is disabled. The pump state is held until automatic mode is re-enabled.');
    setText('tank-auto', 'Auto mode: ' + (pumpAuto ? 'ON' : 'OFF'));
  }
  ['tank-level','pump-low','pump-high'].forEach(id => $(id).addEventListener('input', pumpUpdate));
  $('tank-auto').addEventListener('click', () => { pumpAuto = !pumpAuto; pumpUpdate(); });
  $('tank-reset').addEventListener('click', () => { $('tank-level').value = 65; $('pump-low').value = 30; $('pump-high').value = 90; pumpAuto = true; pumpOn = false; pumpUpdate(); });

  // 07 — smart valve; auto irrigation and manual override.
  let valveAuto = true, valveOpen = false, valveManual = false;
  function valveUpdate() {
    const moisture = Number($('soil-moisture').value);
    const threshold = Number($('soil-threshold').value);
    if (valveAuto) { if (moisture < threshold) valveOpen = true; if (moisture >= Math.min(100, threshold + 15)) valveOpen = false; }
    else valveOpen = valveManual;
    setText('soil-moisture-value', moisture + '%');
    setText('soil-threshold-value', threshold + '%');
    setText('valve-output', valveOpen ? 'OPEN · WATERING' : 'CLOSED');
    setText('valve-status', valveOpen ? 'SOIL DRY · VALVE OPEN' : 'SOIL MOISTURE OK · VALVE CLOSED');
    $('soil-fill').style.height = moisture + '%';
    $('valve-body').classList.toggle('open', valveOpen);
    $('valve-drop').classList.toggle('flow', valveOpen);
    setText('valve-auto', 'Auto mode: ' + (valveAuto ? 'ON' : 'OFF'));
    setText('valve-manual', 'Manual override: ' + (valveManual ? 'OPEN' : 'CLOSED'));
    setText('valve-explain', valveAuto ? (valveOpen ? 'Soil moisture is below the threshold, so the valve opens. As the soil becomes wetter, the controller closes it.' : 'Automatic mode keeps the valve closed while moisture is adequate. Lower moisture below ' + threshold + '% to open it.') : 'Manual mode is active. Use the manual override button to open or close the valve.');
  }
  ['soil-moisture','soil-threshold'].forEach(id => $(id).addEventListener('input', valveUpdate));
  $('valve-auto').addEventListener('click', () => { valveAuto = !valveAuto; valveUpdate(); });
  $('valve-manual').addEventListener('click', () => { valveAuto = false; valveManual = !valveManual; valveUpdate(); });

  // 08 — DHT temperature/humidity values rendered to a 16x2 character LCD.
  function lcdLine(value) { return String(value).slice(0,16).padEnd(16,' '); }
  function dhtUpdate() {
    const t = Number($('dht-temp').value), h = Number($('dht-humidity').value);
    setText('dht-temp-value', t + '°C');
    setText('dht-humidity-value', h + '%');
    setText('lcd-line-1', lcdLine('Temp: ' + t.toFixed(1) + ' C'));
    setText('lcd-line-2', lcdLine('Humidity: ' + h + ' %'));
    let state = 'COMFORTABLE ROOM';
    if (t >= 35) state = 'HOT ENVIRONMENT';
    else if (t <= 16) state = 'COLD ENVIRONMENT';
    else if (h >= 75) state = 'HUMID ENVIRONMENT';
    else if (h <= 30) state = 'DRY ENVIRONMENT';
    setText('env-weather', state);
    setText('dht-explain', 'The Arduino reads ' + t + '°C and ' + h + '% RH, then writes two formatted lines to the LCD. Current environment: ' + state.toLowerCase() + '.');
  }
  ['dht-temp','dht-humidity'].forEach(id => $(id).addEventListener('input', dhtUpdate));

  // 09 — LDR automatic light. ADC rises with brightness in this divider model.
  function ldrUpdate() {
    const light = Number($('ldr-light').value), threshold = Number($('ldr-threshold').value);
    const adc = Math.round(light * 1023 / 100);
    const on = light < threshold;
    setText('ldr-light-value', light + '%');
    setText('ldr-threshold-value', threshold + '%');
    setText('ldr-adc', adc + ' / 1023');
    setText('ldr-output', on ? 'ON' : 'OFF');
    setText('ldr-status', on ? 'DARK · LIGHT ON' : 'DAYLIGHT · LIGHT OFF');
    $('ldr-sun').style.opacity = String(.2 + light / 100 * .8);
    $('ldr-lamp').classList.toggle('on', on);
    setText('ldr-explain', on ? 'Ambient light is below the darkness threshold, so the Arduino switches on the lamp.' : 'The ambient light is above the threshold. The lamp remains off to save energy.');
  }
  ['ldr-light','ldr-threshold'].forEach(id => $(id).addEventListener('input', ldrUpdate));

  // 10 — traffic light finite state machine.
  const trafficStates = [
    {name:'RED',label:'STOP',duration:5,led:0},
    {name:'GREEN',label:'GO',duration:5,led:2},
    {name:'YELLOW',label:'PREPARE',duration:2,led:1}
  ];
  let trafficIndex = 0, trafficRemaining = 5, trafficTimer = null;
  function trafficRender() {
    const s = trafficStates[trafficIndex];
    ['traffic-red','traffic-yellow','traffic-green'].forEach((id,i) => $(id).classList.toggle('on', i === s.led));
    setText('traffic-state', s.name);
    setText('traffic-count', s.label + ' · ' + trafficRemaining + 's');
    setText('traffic-output', s.name + ' · ' + s.label);
  }
  function trafficNext() { trafficIndex = (trafficIndex + 1) % trafficStates.length; trafficRemaining = trafficStates[trafficIndex].duration; trafficRender(); }
  function trafficTick() { trafficRemaining--; if (trafficRemaining <= 0) trafficNext(); else trafficRender(); }
  function trafficStop() { if (trafficTimer) clearInterval(trafficTimer); servoPidStop(); if (solarTimer) clearInterval(solarTimer); if (pidTimer) clearInterval(pidTimer); if (closedTimer) clearInterval(closedTimer); trafficTimer = null; setText('traffic-start', '▶ Start sequence'); }
  $('traffic-start').addEventListener('click', () => {
    if (trafficTimer) { trafficStop(); }
    else { trafficTimer = setInterval(trafficTick, 1000); setText('traffic-start', 'Ⅱ Pause sequence'); }
  });
  $('traffic-step').addEventListener('click', () => { trafficStop(); trafficNext(); });
  $('traffic-reset').addEventListener('click', () => { trafficStop(); trafficIndex = 0; trafficRemaining = 5; trafficRender(); });

  // 11 — proximity-triggered servo door, auto-closes after 3 seconds.
  let servoOpen = false;
  function servoClose() {
    servoOpen = false;
    $('servo-door').classList.remove('open');
    setText('servo-angle', '0° · CLOSED');
    setText('servo-sensor', 'CLEAR');
    setText('servo-status', 'DOOR CLOSED · STANDBY');
    setText('servo-explain', 'The visitor has left the detection area. The controller commands the servo back to 0 degrees.');
  }
  $('servo-detect').addEventListener('click', () => {
    cancel('servo');
    servoOpen = true;
    $('servo-door').classList.add('open');
    setText('servo-angle', '90° · OPEN');
    setText('servo-sensor', 'VISITOR DETECTED');
    setText('servo-status', 'VISITOR DETECTED · DOOR OPEN');
    setText('servo-explain', 'The proximity sensor detected a visitor. The Arduino commands the servo to 90 degrees; it will close after the short simulated hold time.');
    later('servo', servoClose, 3000);
  });
  $('servo-reset').addEventListener('click', () => { cancel('servo'); servoClose(); });

  // 12 — tank high-level alarm.
  function overflowUpdate() {
    const level = Number($('overflow-level').value), threshold = Number($('overflow-threshold').value);
    const alarm = level >= threshold;
    setText('overflow-level-value', level + '%');
    setText('overflow-threshold-value', threshold + '%');
    setText('overflow-output', alarm ? 'ON · HIGH LEVEL' : 'OFF');
    setText('overflow-status', alarm ? 'HIGH LEVEL · BUZZER ON' : 'LEVEL NORMAL · BUZZER OFF');
    $('overflow-water').style.height = level + '%';
    $('overflow-buzzer').classList.toggle('on', alarm);
    setText('overflow-explain', alarm ? 'The level sensor has reached the high-level setpoint. The buzzer warns the operator to stop filling.' : 'The water level is below the alarm setpoint. The buzzer remains off.');
  }
  ['overflow-level','overflow-threshold'].forEach(id => $(id).addEventListener('input', overflowUpdate));


  // 13 — servo-mounted ultrasonic radar: bearing plus measured range.
  function radarUpdate() {
    const angle=Number($('radar-angle').value), bearing=Number($('radar-target-angle').value), distance=Number($('radar-distance').value);
    const hit=Math.abs(angle-bearing)<=8;
    setText('radar-angle-value',angle+'°'); setText('radar-target-angle-value',bearing+'°'); setText('radar-distance-value',distance+' cm');
    $('radar-sweep').style.transform='rotate('+(angle-90)+'deg)';
    const radius=clamp(distance/200*42,5,42);
    $('radar-target').style.left=(50+(bearing-90)/90*radius)+'%';
    $('radar-target').style.top=(50-radius)+'%';
    $('radar-target').style.opacity=distance>180?'.45':'1';
    $('radar-target').style.transform='translate(-50%,-50%)';
    setText('radar-echo',hit?'DETECTED':'NO ECHO'); setText('radar-servo',angle+'°'); setText('radar-range',hit?distance+' cm':'—');
    setText('radar-status',hit?'TARGET IN BEAM · ECHO RECEIVED':'SENSOR AIMING · NO TARGET');
    setText('radar-explain',hit?'The sensor beam is within 8° of the target bearing. The echo time can be converted to range.':'The target is outside the sensor beam. Change the servo angle or target bearing until they align.');
  }
  ['radar-angle','radar-target-angle','radar-distance'].forEach(id=>$ (id).addEventListener('input',radarUpdate));
  $('radar-scan').addEventListener('click',()=>{ $('radar-angle').value=$('radar-target-angle').value; radarUpdate(); });
  $('radar-reset').addEventListener('click',()=>{ $('radar-angle').value=90; $('radar-target-angle').value=125; $('radar-distance').value=80; radarUpdate(); });

  // 14 — parking assistant: distance zones and approximate ultrasonic echo time.
  function parkingUpdate() {
    const cm=Number($('parking-distance').value), echo=cm*58/1000;
    const danger=cm<=20, caution=cm<=60;
    setText('parking-distance-value',cm+' cm'); setText('parking-echo',echo.toFixed(2)+' ms');
    setText('parking-warning',danger?'STOP':caution?'CAUTION':'SAFE');
    setText('parking-beep',danger?'CONTINUOUS':caution?'FAST':'SLOW / OFF');
    setText('parking-status',danger?'TOO CLOSE · STOP':caution?'OBSTACLE APPROACHING':'SAFE DISTANCE');
    $('parking-buzzer').classList.toggle('warn',caution&&!danger); $('parking-buzzer').classList.toggle('danger',danger);
    $('parking-beams').style.right=(clamp(cm/150*38,3,38))+'%';
    $('parking-beams').style.background=danger?'#df5548':caution?'#e2a13b':'#70b6a1';
    setText('parking-explain',danger?'The obstacle is within 20 cm. The simulated buzzer becomes continuous; stop the vehicle.':caution?'The obstacle is within the caution zone. A real controller can shorten the interval between beeps as distance decreases.':'The obstacle is far enough away for the safe zone. The warning output remains inactive.');
  }
  $('parking-distance').addEventListener('input',parkingUpdate);
  $('parking-reset').addEventListener('click',()=>{$('parking-distance').value=100;parkingUpdate();});

  // 15 — proportional temperature control for a DC fan.
  function fanUpdate() {
    const temp=Number($('fan-temp').value), setpoint=Number($('fan-setpoint').value);
    const pwm=Math.round(clamp((temp-setpoint)*18,0,100));
    const cooling=pwm===0?'OFF':pwm<35?'LOW':pwm<70?'MEDIUM':'HIGH';
    setText('fan-temp-value',temp+'°C');setText('fan-setpoint-value',setpoint+'°C');setText('fan-room-temp',temp+'°C');
    setText('fan-pwm',pwm+'%');setText('fan-motor',pwm?'ON':'OFF');setText('fan-cooling',cooling);
    $('fan-visual').classList.toggle('spinning',pwm>0);
    $('fan-visual').style.animationDuration=(pwm?Math.max(.18,1.2-pwm/100):0.25)+'s';
    setText('fan-status',pwm?'FAN RUNNING · '+cooling+' SPEED':'BELOW SETPOINT · FAN OFF');
    setText('fan-explain',pwm?'Temperature is '+(temp-setpoint)+'°C above setpoint. The proportional controller requests '+pwm+'% PWM.':'Temperature is at or below the setpoint, so the fan is off.');
  }
  ['fan-temp','fan-setpoint'].forEach(id=>$ (id).addEventListener('input',fanUpdate));

  // 16 — two digital reflectance sensors and a simple line-following truth table.
  let lineLeft=false,lineRight=false;
  function lineUpdate() {
    $('line-left-eye').classList.toggle('detect',lineLeft);$('line-right-eye').classList.toggle('detect',lineRight);
    setText('line-left-state',lineLeft?'YES · BLACK':'NO · WHITE');setText('line-right-state',lineRight?'YES · BLACK':'NO · WHITE');
    let left=0,right=0,action='STOP',status='BOTH SENSORS ON WHITE · LINE LOST',explain='Both sensors see the white floor. The basic controller stops because it cannot locate the line.';
    if(lineLeft&&lineRight){left=65;right=65;action='FORWARD';status='BOTH SENSORS ON LINE · FORWARD';explain='Both sensors detect the black line. The robot drives forward at matching motor speeds.';}
    else if(lineLeft){left=28;right=72;action='TURN LEFT';status='LEFT SENSOR ON LINE · CORRECT LEFT';explain='Only the left sensor sees the line. The controller slows the left wheel and speeds up the right wheel to steer left.';}
    else if(lineRight){left=72;right=28;action='TURN RIGHT';status='RIGHT SENSOR ON LINE · CORRECT RIGHT';explain='Only the right sensor sees the line. The controller slows the right wheel and speeds up the left wheel to steer right.';}
    $('line-bot').style.transform=action==='TURN LEFT'?'rotate(-8deg) translateX(-8px)':action==='TURN RIGHT'?'rotate(8deg) translateX(8px)':'';
    setText('line-left-motor',left+'%');setText('line-right-motor',right+'%');setText('line-action',action);setText('line-status',status);setText('line-explain',explain);
  }
  $('line-left-toggle').addEventListener('click',()=>{lineLeft=!lineLeft;lineUpdate();});
  $('line-right-toggle').addEventListener('click',()=>{lineRight=!lineRight;lineUpdate();});
  $('line-reset').addEventListener('click',()=>{lineLeft=false;lineRight=false;lineUpdate();});


  // 17 — stepper motor angle-to-pulse model.
  let stepperPosition=0;
  function stepperUpdate(){const target=Number($('stepper-target').value),mode=Number($('stepper-mode').value),pulses=Math.round(Math.abs(target-stepperPosition)/360*200*mode);setText('stepper-target-value',target+'°');setText('stepper-position',stepperPosition+'°');setText('stepper-pulses',pulses);setText('stepper-state',target===stepperPosition?'HOLDING':'TARGET READY');setText('stepper-status',target===stepperPosition?'POSITION REACHED':'READY · '+pulses+' PULSES');$('stepper-rotor').style.transform='rotate('+stepperPosition+'deg)';setText('stepper-explain','At '+(1.8/mode).toFixed(3)+'° per pulse, moving from '+stepperPosition+'° to '+target+'° requires about '+pulses+' pulses.');}
  ['stepper-target','stepper-mode'].forEach(id=>$(id).addEventListener('input',stepperUpdate));$('stepper-move').addEventListener('click',()=>{stepperPosition=Number($('stepper-target').value);stepperUpdate();});$('stepper-zero').addEventListener('click',()=>{stepperPosition=0;stepperUpdate();});
  // 18 — IR remote command decoder demonstration.
  const irCodes={POWER:'0xFFA25D',UP:'0xFF629D',MODE:'0xFFE21D',LEFT:'0xFF22DD',OK:'0xFF02FD',RIGHT:'0xFFC23D',DOWN:'0xFFA857'},irActions={POWER:'Toggle main output',UP:'Increase setting',MODE:'Change operating mode',LEFT:'Move left',OK:'Confirm selection',RIGHT:'Move right',DOWN:'Decrease setting'};
  document.querySelectorAll('[data-ir]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.ir;$('ir-transmitter').classList.add('sending');setText('ir-receiver-state','DECODED');setText('ir-command',k);setText('ir-code',irCodes[k]);setText('ir-action',irActions[k]);setText('ir-status','COMMAND RECEIVED · '+k);setText('ir-explain','The receiver decoded '+k+' ('+irCodes[k]+'). The sketch can execute: '+irActions[k]+'.');}));
  $('ir-clear').addEventListener('click',()=>{$('ir-transmitter').classList.remove('sending');setText('ir-receiver-state','WAITING');setText('ir-command','NONE');setText('ir-code','—');setText('ir-action','No action');setText('ir-status','POINT REMOTE AT RECEIVER');});
  // 19 — battery voltage divider and illustrative voltage estimate.
  function batteryUpdate(){const v=Number($('battery-voltage').value),a=Number($('battery-load').value),divider=v/3,adc=Math.round(divider/5*1023),pct=clamp((v-9.6)/3*100,0,100),low=v<=10.5,warn=v<=11;setText('battery-voltage-value',v.toFixed(1)+' V');setText('battery-load-value',a.toFixed(1)+' A');setText('battery-voltage-read',v.toFixed(1)+' V');setText('battery-percent',Math.round(pct)+'%');setText('battery-adc',adc+' / 1023');setText('battery-divider',divider.toFixed(2)+' V');setText('battery-power',(v*a).toFixed(1)+' W');setText('battery-health',low?'LOW VOLTAGE':warn?'CHECK BATTERY':'NORMAL');setText('battery-status',low?'LOW VOLTAGE · DISCONNECT LOAD':warn?'BATTERY VOLTAGE FALLING':'BATTERY LEVEL NORMAL');$('battery-fill').style.height=pct+'%';$('battery-fill').classList.toggle('low',warn);setText('battery-explain','A 3:1 divider converts '+v.toFixed(1)+' V to '+divider.toFixed(2)+' V at the ADC ('+adc+'/1023). The '+Math.round(pct)+'% estimate is illustrative, not a fuel gauge.');}
  ['battery-voltage','battery-load'].forEach(id=>$(id).addEventListener('input',batteryUpdate));
  // 20 — encoder pulse frequency and period from RPM and PPR.
  function encoderUpdate(){const rpm=Number($('encoder-rpm-input').value),ppr=Number($('encoder-ppr').value),hz=rpm*ppr/60,period=hz?1000/hz:0;setText('encoder-rpm-value',rpm+' RPM');setText('encoder-rpm',rpm+' RPM');setText('encoder-frequency',hz.toFixed(1)+' Hz');setText('encoder-period',hz?period.toFixed(1)+' ms':'—');setText('encoder-counts',hz.toFixed(1));setText('encoder-status',rpm?'WHEEL TURNING':'WHEEL STOPPED');setText('encoder-scene-status',rpm?'ENCODER PULSES DETECTED':'NO PULSES · MOTOR STOPPED');$('encoder-wheel').classList.toggle('turning',rpm>0);$('encoder-wheel').style.animationDuration=rpm?Math.max(.25,60/rpm)+'s':'0s';setText('encoder-explain',rpm+' RPM × '+ppr+' pulses/rev ÷ 60 = '+hz.toFixed(1)+' pulses per second. Pulse period: '+(hz?period.toFixed(1)+' ms':'—')+'.');}
  ['encoder-rpm-input','encoder-ppr'].forEach(id=>$(id).addEventListener('input',encoderUpdate));


  // 21 — single-axis LDR solar tracker.
  let solarPanelAngle=0, solarTimer=null, solarAuto=false;
  function solarRender(){const sun=Number($('solar-sun-angle').value),error=sun-solarPanelAngle,left=Math.round(clamp(512-error*6,0,1023)),right=Math.round(clamp(512+error*6,0,1023));setText('solar-sun-value',sun+'°');setText('solar-panel-value',solarPanelAngle+'°');setText('solar-servo-angle',(solarPanelAngle+90)+'° SERVO');setText('solar-left-ldr',left);setText('solar-right-ldr',right);setText('solar-difference',Math.abs(right-left));$('solar-panel-angle').value=solarPanelAngle;$('solar-panel').style.transform='rotate('+(-solarPanelAngle*.35)+'deg)';$('solar-sun-visual').style.left='calc(50% + '+(sun/60*31)+'%)';$('solar-beam').style.transform='rotate('+(sun*.35)+'deg)';const aligned=Math.abs(error)<=2;setText('solar-status',aligned?'PANEL ALIGNED · LIGHT BALANCED':'LIGHT ERROR · '+(error>0?'TURN RIGHT':'TURN LEFT'));setText('solar-explain',aligned?'Both LDR readings are close. The panel is facing the sun in this simplified model.':'The brighter sensor indicates the direction of travel. The servo should rotate toward the sun until the sensor difference is small.');setText('solar-auto',solarAuto?'Stop auto tracking':'Start auto tracking');}
  function solarStop(){if(solarTimer){clearInterval(solarTimer);solarTimer=null;}solarAuto=false;solarRender();}
  $('solar-sun-angle').addEventListener('input',solarRender);$('solar-panel-angle').addEventListener('input',()=>{solarPanelAngle=Number($('solar-panel-angle').value);if(solarAuto)solarStop();solarRender();});
  $('solar-track-now').addEventListener('click',()=>{solarPanelAngle=Number($('solar-sun-angle').value);solarRender();});
  $('solar-auto').addEventListener('click',()=>{if(solarAuto){solarStop();return;}solarAuto=true;solarRender();solarTimer=setInterval(()=>{const diff=Number($('solar-sun-angle').value)-solarPanelAngle;if(Math.abs(diff)<=1){solarPanelAngle=Number($('solar-sun-angle').value);solarStop();return;}solarPanelAngle+=Math.sign(diff)*2;solarRender();},180);});

  // 22 — simplified inverted-pendulum PID balancing demonstration.
  let pidAngle=8,pidRate=0,pidIntegral=0,pidLastError=-8,pidOutput=0,pidTimer=null,pidRunning=false;
  function pidStop(){if(pidTimer){clearInterval(pidTimer);pidTimer=null;}pidRunning=false;setText('pid-start','Start balancing');}
  function pidRender(){const setpoint=Number($('pid-setpoint').value),error=setpoint-pidAngle;setText('pid-kp-value',Number($('pid-kp').value).toFixed(0));setText('pid-ki-value',Number($('pid-ki').value).toFixed(1));setText('pid-kd-value',Number($('pid-kd').value).toFixed(1));setText('pid-setpoint-value',setpoint+'°');setText('pid-disturbance-value',Number($('pid-disturbance').value)+'°');setText('pid-angle',pidAngle.toFixed(1)+'°');setText('pid-error',error.toFixed(1)+'°');setText('pid-output',Math.round(pidOutput)+' PWM');setText('pid-integral',pidIntegral.toFixed(1));$('pid-robot').style.transform='rotate('+pidAngle+'deg)';const tipped=Math.abs(pidAngle)>=30,balanced=Math.abs(error)<1&&Math.abs(pidRate)<1;setText('pid-status',tipped?'FALLEN':balanced?'BALANCED':pidRunning?'CORRECTING TILT':'READY TO BALANCE');setText('pid-scene-status',tipped?'TILT LIMIT REACHED':balanced?'UPRIGHT · CORRECTION SMALL':pidRunning?'MOTOR CORRECTION ACTIVE':'MOTORS IDLE · ROBOT LEANING');setText('pid-explain','P term: '+(Number($('pid-kp').value)*error).toFixed(1)+', I term: '+(Number($('pid-ki').value)*pidIntegral).toFixed(1)+', D term: '+(Number($('pid-kd').value)*(-pidRate)).toFixed(1)+'. The combined output commands opposite wheel torque to correct tilt.');}
  function pidTick(){const dt=.05,setpoint=Number($('pid-setpoint').value),kp=Number($('pid-kp').value),ki=Number($('pid-ki').value),kd=Number($('pid-kd').value),error=setpoint-pidAngle;pidIntegral=clamp(pidIntegral+error*dt,-20,20);const derivative=(error-pidLastError)/dt;pidOutput=clamp(kp*error+ki*pidIntegral+kd*derivative,-255,255);const acceleration=(pidAngle-setpoint)*.75+pidOutput*.07-pidRate*.75;pidRate+=acceleration*dt;pidAngle=clamp(pidAngle+pidRate*dt,-35,35);pidLastError=error;pidRender();if(Math.abs(pidAngle)>=35)pidStop();}
  ['pid-kp','pid-ki','pid-kd','pid-disturbance'].forEach(id=>$(id).addEventListener('input',pidRender));$('pid-setpoint').addEventListener('input',()=>{pidLastError=Number($('pid-setpoint').value)-pidAngle;pidRender();});
  $('pid-start').addEventListener('click',()=>{if(pidRunning){pidStop();pidRender();return;}pidRunning=true;pidLastError=Number($('pid-setpoint').value)-pidAngle;setText('pid-start','Pause balancing');pidTimer=setInterval(pidTick,50);});
  $('pid-push').addEventListener('click',()=>{pidAngle=clamp(pidAngle+Number($('pid-disturbance').value),-35,35);pidRender();});
  $('pid-reset').addEventListener('click',()=>{pidStop();pidAngle=8;pidRate=0;pidIntegral=0;pidLastError=-8;pidOutput=0;pidRender();});

  // 23 — closed-loop DC motor speed control with a simplified PI controller.
  let closedRpm=0,closedIntegral=0,closedPwm=0,closedTimer=null,closedRunning=false;
  function closedRender(error=Number($('closed-target').value)-closedRpm){setText('closed-target-value',Number($('closed-target').value)+' RPM');setText('closed-load-value',Number($('closed-load').value)+'%');setText('closed-kp-value',Number($('closed-kp').value).toFixed(3));setText('closed-ki-value',Number($('closed-ki').value).toFixed(3));setText('closed-rpm',Math.round(closedRpm)+' RPM');setText('closed-pwm',Math.round(closedPwm)+' / 255');setText('closed-error',Math.round(error)+' RPM');setText('closed-feedback',Math.round(closedRpm)+' RPM');$('closed-speed-bar').style.width=clamp(closedRpm/3000*100,0,100)+'%';$('closed-motor').classList.toggle('spinning',closedRpm>10);$('closed-motor').style.animationDuration=Math.max(.12,1.8*600/Math.max(closedRpm,100))+'s';setText('closed-state',closedRunning?'MOTOR RUNNING':closedRpm>10?'COASTING DOWN':'MOTOR STOPPED');setText('closed-status',closedRunning?'ENCODER FEEDBACK ACTIVE':'CONTROLLER STOPPED');setText('closed-explain','Target '+Number($('closed-target').value)+' RPM, measured '+Math.round(closedRpm)+' RPM, error '+Math.round(error)+' RPM. PWM is adjusted from the feed-forward command plus PI correction.');}
  function closedTick(){const dt=.1,target=Number($('closed-target').value),load=Number($('closed-load').value),kp=Number($('closed-kp').value),ki=Number($('closed-ki').value),error=target-closedRpm;if(target===0){closedIntegral=0;closedPwm=0;}else{closedIntegral=clamp(closedIntegral+error*dt,-5000,5000);closedPwm=clamp(target/3000*255+kp*error+ki*closedIntegral,0,255);}const loadDrop=load/100*3000*.65,plantSpeed=Math.max(0,closedPwm/255*3000-loadDrop);closedRpm+=(plantSpeed-closedRpm)*.18;closedRender(error);}
  ['closed-target','closed-load','closed-kp','closed-ki'].forEach(id=>$(id).addEventListener('input',()=>closedRender()));
  $('closed-start').addEventListener('click',()=>{if(closedRunning){clearInterval(closedTimer);closedTimer=null;closedRunning=false;setText('closed-start','Start controller');closedRender();return;}closedRunning=true;setText('closed-start','Stop controller');closedTimer=setInterval(closedTick,100);});
  $('closed-reset').addEventListener('click',()=>{if(closedTimer)clearInterval(closedTimer);closedTimer=null;closedRunning=false;closedRpm=0;closedIntegral=0;closedPwm=0;setText('closed-start','Start controller');closedRender();});

  // 24 — TB6612-style H-bridge direction and braking logic.
  let hbridgeMode='coast';
  function hbridgeUpdate(){const pwm=Number($('hbridge-pwm').value),states={forward:[1,0],reverse:[0,1],coast:[0,0],brake:[1,1]},pins=states[hbridgeMode],drivePwm=hbridgeMode==='brake'?255:hbridgeMode==='coast'?0:pwm,speed=(hbridgeMode==='forward'||hbridgeMode==='reverse')?Math.round(drivePwm/255*3000):0;setText('hbridge-pwm-value',pwm+' / 255');setText('hbridge-state',hbridgeMode.toUpperCase());setText('hbridge-direction',hbridgeMode==='forward'?'CLOCKWISE':hbridgeMode==='reverse'?'COUNTER-CLOCKWISE':hbridgeMode==='brake'?'ELECTRICAL BRAKE':'OUTPUTS RELEASED');setText('hbridge-in1',pins[0]?'HIGH':'LOW');setText('hbridge-in2',pins[1]?'HIGH':'LOW');setText('hbridge-speed',speed+' RPM');setText('hbridge-status','IN1 '+(pins[0]?'HIGH':'LOW')+' · IN2 '+(pins[1]?'HIGH':'LOW')+' · PWM '+drivePwm);$('hbridge-wheel').classList.toggle('reverse',hbridgeMode==='reverse');$('hbridge-wheel').classList.toggle('spinning',speed>0);$('hbridge-wheel').style.animationDuration=Math.max(.12,1.8*600/Math.max(speed,100))+'s';document.querySelectorAll('[data-hbridge]').forEach(b=>b.classList.toggle('active',b.dataset.hbridge===hbridgeMode));setText('hbridge-explain',hbridgeMode==='forward'?'IN1 HIGH and IN2 LOW drive the motor forward. PWM controls the average drive command.':hbridgeMode==='reverse'?'IN1 LOW and IN2 HIGH reverse the motor polarity.':hbridgeMode==='brake'?'Both direction inputs HIGH select the TB6612FNG short-brake state; PWM is held HIGH for braking.':'Both direction inputs LOW select coast, allowing the motor to spin down freely.');}
  document.querySelectorAll('[data-hbridge]').forEach(b=>b.addEventListener('click',()=>{hbridgeMode=b.dataset.hbridge;hbridgeUpdate();}));
  $('hbridge-pwm').addEventListener('input',hbridgeUpdate);


  // 25 — differential-drive wheel command mixer.
  let driveMode='stop';
  function driveUpdate(){const base=Number($('drive-speed').value);let left=0,right=0;switch(driveMode){case'forward':left=base;right=base;break;case'reverse':left=-base;right=-base;break;case'left':left=-base;right=base;break;case'right':left=base;right=-base;break;}const avg=(left+right)/2,diff=right-left;let action=driveMode==='stop'?'STOP':driveMode==='left'?'PIVOT LEFT':driveMode==='right'?'PIVOT RIGHT':driveMode.toUpperCase();setText('drive-speed-value',base+'%');setText('drive-left',(left>0?'+':'')+left+'%');setText('drive-right',(right>0?'+':'')+right+'%');setText('drive-average',avg.toFixed(0)+'%');setText('drive-action',action);setText('drive-turn',diff===0?'NO TURN':diff>0?'ROTATE LEFT':'ROTATE RIGHT');setText('drive-status',driveMode==='stop'?'MOTORS STOPPED':'LEFT '+left+'% · RIGHT '+right+'%');$('drive-robot').classList.toggle('moving',base>0&&driveMode!=='stop');$('drive-robot').classList.toggle('reverse',driveMode==='reverse');$('drive-robot').classList.toggle('pivot-left',driveMode==='left');$('drive-robot').classList.toggle('pivot-right',driveMode==='right');$('drive-robot').style.setProperty('--drive-turn',(diff*.32)+'deg');document.querySelectorAll('[data-drive-mode]').forEach(b=>b.classList.toggle('active',b.dataset.driveMode===driveMode));setText('drive-explain',left===right?'Both wheels receive the same signed command, so the ideal robot moves straight.':driveMode==='stop'?'Both wheel commands are zero.':driveMode==='left'||driveMode==='right'?'The wheels run in opposite directions, rotating the robot around its centre.':'Unequal wheel commands make the robot follow a curved path.');}
  document.querySelectorAll('[data-drive-mode]').forEach(b=>b.addEventListener('click',()=>{driveMode=b.dataset.driveMode;driveUpdate();}));$('drive-speed').addEventListener('input',driveUpdate);
  // 26 — three-range-sensor obstacle decision logic.
  function avoidUpdate(){const f=Number($('avoid-front').value),l=Number($('avoid-left').value),r=Number($('avoid-right').value),t=Number($('avoid-threshold').value);let decision='FORWARD',side='NONE',motors='FWD / FWD',explain='The front reading is beyond the threshold, so the robot continues forward.';if(f<=t){if(l<=t&&r<=t){decision='REVERSE';side='BLOCKED';motors='REV / REV';explain='Front and both sides are too close. Reverse to create room before scanning again.';}else if(l>r){decision='TURN LEFT';side='LEFT';motors='REV / FWD';explain='The front is blocked. The left side has more clearance, so the robot pivots left.';}else{decision='TURN RIGHT';side='RIGHT';motors='FWD / REV';explain='The front is blocked. The right side has more clearance, so the robot pivots right.';}}setText('avoid-front-value',f+' cm');setText('avoid-left-value',l+' cm');setText('avoid-right-value',r+' cm');setText('avoid-threshold-value',t+' cm');setText('avoid-decision',decision);setText('avoid-side',side);setText('avoid-motors',motors);setText('avoid-status',decision==='FORWARD'?'PATH CLEAR · MOVING FORWARD':'OBSTACLE · '+decision);setText('avoid-explain',explain);$('avoid-robot').classList.toggle('avoid-left',decision==='TURN LEFT');$('avoid-robot').classList.toggle('avoid-right',decision==='TURN RIGHT');$('avoid-robot').classList.toggle('avoid-reverse',decision==='REVERSE');$('avoid-front-obstacle').style.opacity=f<=t?1:.35;$('avoid-left-obstacle').style.opacity=l<=t?1:.35;$('avoid-right-obstacle').style.opacity=r<=t?1:.35;}
  ['avoid-front','avoid-left','avoid-right','avoid-threshold'].forEach(id=>$(id).addEventListener('input',avoidUpdate));
  // 27 — weighted three-sensor proportional line controller.
  let line3Left=false,line3Centre=true,line3Right=false;
  function line3Update(){const kp=Number($('line3-kp').value),base=Number($('line3-base').value),active=[];if(line3Left)active.push(-1);if(line3Centre)active.push(0);if(line3Right)active.push(1);const lost=active.length===0,position=lost?0:active.reduce((a,b)=>a+b,0)/active.length,correction=lost?0:Math.round(kp*position),left=lost?0:clamp(base+correction,0,100),right=lost?0:clamp(base-correction,0,100);setText('line3-left-state',line3Left?'YES':'NO');setText('line3-other-state',(line3Centre?'YES':'NO')+' / '+(line3Right?'YES':'NO'));setText('line3-kp-value',kp);setText('line3-base-value',base+'%');setText('line3-error',lost?'LOST':position.toFixed(2));setText('line3-correction',correction);setText('line3-motors',Math.round(left)+' / '+Math.round(right));setText('line3-status',lost?'LINE LOST · STOP':position<-.05?'LINE LEFT · STEER LEFT':position>.05?'LINE RIGHT · STEER RIGHT':'CENTRED · STRAIGHT');$('line3-left-eye').classList.toggle('detect',line3Left);$('line3-centre-eye').classList.toggle('detect',line3Centre);$('line3-right-eye').classList.toggle('detect',line3Right);$('line3-bot').style.transform=lost?'translateX(0) rotate(0deg)': 'translateX('+(position*13)+'px) rotate('+(-position*8)+'deg)';$('line3-path').style.transform='translateX('+(position*14)+'px)';setText('line3-explain',lost?'No sensor sees the line. This simple controller stops; a real robot may use the last known direction to search.':'Estimated line position '+position.toFixed(2)+'. P correction is '+correction+'; left and right motor commands are '+Math.round(left)+'% and '+Math.round(right)+'%.');}
  $('line3-left-toggle').addEventListener('click',()=>{line3Left=!line3Left;line3Update();});$('line3-centre-toggle').addEventListener('click',()=>{line3Centre=!line3Centre;line3Update();});$('line3-right-toggle').addEventListener('click',()=>{line3Right=!line3Right;line3Update();});['line3-kp','line3-base'].forEach(id=>$(id).addEventListener('input',line3Update));$('line3-reset').addEventListener('click',()=>{line3Left=false;line3Centre=true;line3Right=false;$('line3-kp').value=25;$('line3-base').value=65;line3Update();});
  // 28 — two-link planar arm forward kinematics.
  function armUpdate(){const s=Number($('arm-shoulder').value),e=Number($('arm-elbow').value),a=(s-90)*Math.PI/180,b=(e-90)*Math.PI/180,L1=80,L2=62,x=L1*Math.cos(a)+L2*Math.cos(a+b),y=L1*Math.sin(a)+L2*Math.sin(a+b),reach=Math.hypot(x,y);setText('arm-shoulder-value',s+'°');setText('arm-elbow-value',e+'°');setText('arm-x',x.toFixed(0)+' mm');setText('arm-y',y.toFixed(0)+' mm');setText('arm-reach',reach.toFixed(0)+' mm');setText('arm-position','X '+x.toFixed(0)+' · Y '+y.toFixed(0));setText('arm-state',reach>140?'NEAR FULL EXTENSION':reach<25?'FOLDED':'WITHIN REACH');setText('arm-status','SHOULDER '+s+'° · ELBOW '+e+'°');$('arm-link-one').style.transform='rotate('+(- (s-90))+'deg)';$('arm-link-two').style.transform='rotate('+(- (e-90))+'deg)';setText('arm-explain','Link 1 contributes '+(L1*Math.cos(a)).toFixed(0)+' mm horizontally and '+(L1*Math.sin(a)).toFixed(0)+' mm vertically. Link 2 adds its contribution at the combined joint angle.');}
  ['arm-shoulder','arm-elbow'].forEach(id=>$(id).addEventListener('input',armUpdate));$('arm-home').addEventListener('click',()=>{$('arm-shoulder').value=90;$('arm-elbow').value=90;armUpdate();});


  // 29 — quadrature counts, signed distance from wheel rotation.
  function quadUpdate(){const angle=Number($('quad-turn').value),ppr=Number($('quad-ppr').value),diam=Number($('quad-diameter').value),counts=Math.round(angle/360*ppr*4),distance=angle/360*Math.PI*(diam/1000);setText('quad-turn-value',(angle>0?'+':'')+angle+'°');setText('quad-diameter-value',diam+' mm');setText('quad-counts',counts);setText('quad-distance',distance.toFixed(3)+' m');setText('quad-sign',angle<0?'Reverse':'Forward');setText('quad-state',angle<0?'10':'01');setText('quad-direction',angle<0?'REVERSE':angle>0?'FORWARD':'STOPPED');setText('quad-status',counts+' COUNTS · '+distance.toFixed(3)+' m');$('quad-wheel').style.transform='rotate('+angle+'deg)';setText('quad-explain',ppr+' cycles/rev × 4 edges gives '+(ppr*4)+' counts/rev. '+angle+'° produces '+counts+' signed counts and ideal wheel travel '+distance.toFixed(3)+' m.');}
  ['quad-turn','quad-ppr','quad-diameter'].forEach(id=>$(id).addEventListener('input',quadUpdate));$('quad-reset').addEventListener('click',()=>{$('quad-turn').value=0;quadUpdate();});
  // 30 — normalized mecanum inverse kinematics mixer.
  function mecanumUpdate(){const x=Number($('mecanum-x').value),y=Number($('mecanum-y').value),r=Number($('mecanum-r').value),raw=[y+x+r,y-x-r,y-x+r,y+x-r],max=Math.max(100,...raw.map(Math.abs)),w=raw.map(v=>Math.round(v/max*100));['fl','fr'].forEach((k,i)=>setText('mecanum-'+k,w[i]+'%'));setText('mecanum-rlrr',w[2]+' / '+w[3]+'%');setText('mecanum-x-value',x);setText('mecanum-y-value',y);setText('mecanum-r-value',r);const mode=Math.abs(x)>Math.abs(y)?'STRAFE':Math.abs(r)>Math.abs(x+y)?'ROTATE':y?'FORWARD / REVERSE':'IDLE';setText('mecanum-mode',mode);setText('mecanum-heading',Math.round(Math.atan2(x,y)*180/Math.PI)+'°');setText('mecanum-status',w.every(v=>v===0)?'ALL WHEELS STOPPED':'MOTOR MIX ACTIVE');$('mecanum-robot').style.transform='translate('+x*.18+'px,'+-y*.12+'px) rotate('+r*.25+'deg)';setText('mecanum-explain','Raw wheel mix FL='+raw[0]+', FR='+raw[1]+', RL='+raw[2]+', RR='+raw[3]+'. Normalized commands: '+w.join(', ')+'%.');}
  ['mecanum-x','mecanum-y','mecanum-r'].forEach(id=>$(id).addEventListener('input',mecanumUpdate));$('mecanum-stop').addEventListener('click',()=>{['mecanum-x','mecanum-y','mecanum-r'].forEach(id=>$(id).value=0);mecanumUpdate();});
  // 31 — wrap-aware heading proportional control.
  let heading=0;
  function headingUpdate(){const target=Number($('heading-target').value),kp=Number($('heading-kp').value);let error=target-heading;while(error>180)error-=360;while(error< -180)error+=360;const output=clamp(kp*error,-100,100);setText('heading-target-value',target+'°');setText('heading-kp-value',kp.toFixed(1));setText('heading-angle',Math.round(heading)+'°');setText('heading-error',Math.round(error)+'°');setText('heading-output',Math.round(output)+'%');setText('heading-state',Math.abs(error)<3?'ON TARGET':'CORRECTING');setText('heading-status',Math.abs(error)<3?'HEADING HOLD':'TURN COMMAND · '+(output>0?'RIGHT':'LEFT'));$('heading-needle').style.transform='rotate('+heading+'deg)';setText('heading-explain','Shortest wrapped error is '+error.toFixed(1)+'°. P output '+(kp*error).toFixed(1)+' is limited to '+output.toFixed(1)+'% to avoid exceeding the motor command range.');}
  ['heading-target','heading-kp'].forEach(id=>$(id).addEventListener('input',headingUpdate));$('heading-disturb').addEventListener('click',()=>{heading=heading+35;if(heading>180)heading-=360;headingUpdate();});$('heading-reset').addEventListener('click',()=>{heading=0;headingUpdate();});
  // 32 — discrete PID position plant, 20 ms steps.
  let servoPidTimer=null,servoPosition=0,servoVelocity=0,servoIntegral=0,servoPrevious=0,servoElapsed=0;
  function servoPidRender(){const target=Number($('servo-pid-target').value),kp=Number($('servo-pid-kp').value),ki=Number($('servo-pid-ki').value),kd=Number($('servo-pid-kd').value),error=target-servoPosition;setText('servo-pid-target-value',target+'°');setText('servo-pid-kp-value',kp.toFixed(1));setText('servo-pid-ki-value',ki.toFixed(1));setText('servo-pid-kd-value',kd.toFixed(1));setText('servo-pid-position',Math.round(servoPosition)+'°');setText('servo-pid-live',Math.round(servoPosition)+'°');setText('servo-pid-error',Math.round(error)+'°');setText('servo-pid-drive',Math.round(clamp(kp*error+ki*servoIntegral+kd*(error-servoPrevious)/.02,-100,100))+'%');setText('servo-pid-settle',Math.abs(error)<2?'SETTLED':servoElapsed.toFixed(1)+' s');setText('servo-pid-state',Math.abs(error)<2?'ON TARGET':'MOVING');$('servo-pid-pointer').style.transform='rotate('+servoPosition+'deg)';setText('servo-pid-status',Math.abs(error)<2?'POSITION HOLD':'PID ACTIVE');}
  function servoPidStop(){if(servoPidTimer){clearInterval(servoPidTimer);servoPidTimer=null;}}
  function servoPidStep(){const target=Number($('servo-pid-target').value),kp=Number($('servo-pid-kp').value),ki=Number($('servo-pid-ki').value),kd=Number($('servo-pid-kd').value),dt=.02,error=target-servoPosition;servoIntegral=clamp(servoIntegral+error*dt,-100,100);const derivative=(error-servoPrevious)/dt,drive=clamp(kp*error+ki*servoIntegral+kd*derivative,-100,100);servoVelocity+=drive*.025;servoVelocity*=.88;servoPosition=clamp(servoPosition+servoVelocity*dt,-90,90);servoPrevious=error;servoElapsed+=dt;servoPidRender();if(Math.abs(error)<1.5&&Math.abs(servoVelocity)<.5){servoPidStop();setText('servo-pid-status','SETTLED · '+servoElapsed.toFixed(1)+' s');}}
  ['servo-pid-target','servo-pid-kp','servo-pid-ki','servo-pid-kd'].forEach(id=>$(id).addEventListener('input',servoPidRender));$('servo-pid-run').addEventListener('click',()=>{servoPidStop();servoElapsed=0;servoPrevious=Number($('servo-pid-target').value)-servoPosition;servoPidTimer=setInterval(servoPidStep,20);});$('servo-pid-reset').addEventListener('click',()=>{servoPidStop();servoPosition=0;servoVelocity=0;servoIntegral=0;servoPrevious=0;servoElapsed=0;servoPidRender();});

  // Initialise all project states.
  $('sp-year').textContent = new Date().getFullYear();
  pirOff(); digitalUpdate(false); analogUpdate(); fireUpdate(); gasUpdate(); pumpUpdate(); radarUpdate(); parkingUpdate(); fanUpdate(); lineUpdate(); stepperUpdate(); batteryUpdate(); encoderUpdate(); solarRender(); pidRender(); closedRender(); hbridgeUpdate(); driveUpdate(); avoidUpdate(); line3Update(); armUpdate(); quadUpdate(); mecanumUpdate(); headingUpdate(); servoPidRender();
  valveUpdate(); dhtUpdate(); ldrUpdate(); trafficRender(); servoClose(); overflowUpdate();
  window.addEventListener('beforeunload', () => { timers.forEach(clearTimeout); if (trafficTimer) clearInterval(trafficTimer); });
})();