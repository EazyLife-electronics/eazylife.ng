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
  function trafficStop() { if (trafficTimer) clearInterval(trafficTimer); trafficTimer = null; setText('traffic-start', '▶ Start sequence'); }
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

  // Initialise all project states.
  $('sp-year').textContent = new Date().getFullYear();
  pirOff(); digitalUpdate(false); analogUpdate(); fireUpdate(); gasUpdate(); pumpUpdate(); radarUpdate(); parkingUpdate(); fanUpdate(); lineUpdate(); stepperUpdate(); batteryUpdate(); encoderUpdate();
  valveUpdate(); dhtUpdate(); ldrUpdate(); trafficRender(); servoClose(); overflowUpdate();
  window.addEventListener('beforeunload', () => { timers.forEach(clearTimeout); if (trafficTimer) clearInterval(trafficTimer); });
})();