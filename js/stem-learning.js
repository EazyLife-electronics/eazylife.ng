/* EazyLife STEM Learning: potentiometer-to-LED behavioural model and module interactions. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const slider = $('pot-position');
  if (slider) {
    function updateExperiment() {
      const position = Number(slider.value);
      const voltage = position / 100 * 5;
      const adc = Math.round(position / 100 * 1023);
      const pwm = Math.floor(adc * 255 / 1023);
      const brightness = pwm / 255 * 100;
      $('pot-percent').textContent = position + '%';
      $('pot-voltage').textContent = voltage.toFixed(2) + ' V';
      $('pot-adc').textContent = adc + ' / 1023';
      $('pot-pwm').textContent = pwm + ' / 255';
      $('led-brightness').textContent = Math.round(brightness) + '%';
      $('brightness-fill').style.width = brightness + '%';
      $('pot-marker').style.left = position + '%';
      $('led-glow').style.opacity = String(0.04 + brightness / 100 * 0.72);
      $('led-glow').style.transform = 'scale(' + (0.55 + brightness / 100 * 0.8) + ')';
      $('led-bulb').style.opacity = String(0.28 + brightness / 100 * 0.72);
      $('led-bulb').style.filter = 'brightness(' + (0.55 + brightness / 100 * 0.9) + ')';
      $('pot-explanation').textContent = 'At ' + position + '% potentiometer position, the wiper voltage is approximately ' + voltage.toFixed(2) + ' V. The 10-bit ADC produces ' + adc + ' and the mapped 8-bit PWM command is ' + pwm + '.';
    }
    slider.addEventListener('input', updateExperiment);
    $('pot-reset').addEventListener('click', () => { slider.value = '50'; updateExperiment(); });
    updateExperiment();
  }

  const copyButton = $('copy-code');
  if (copyButton) {
    copyButton.addEventListener('click', async () => {
      const code = $('arduino-code').textContent;
      const feedback = $('copy-feedback');
      try {
        await navigator.clipboard.writeText(code);
        feedback.textContent = 'Code copied. Paste it into the Arduino IDE.';
      } catch (error) {
        feedback.textContent = 'Copy was blocked by this browser. Select the code above and copy it manually.';
      }
    });
  }

  const quiz = $('quiz');
  if (quiz) {
    quiz.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => {
        quiz.querySelectorAll('button').forEach(option => {
          option.classList.remove('correct', 'incorrect');
          option.disabled = true;
        });
        const correct = button.dataset.correct === 'true';
        button.classList.add(correct ? 'correct' : 'incorrect');
        $('quiz-feedback').textContent = correct
          ? 'Correct. The Uno ADC has 10-bit resolution (0–1023), while analogWrite() accepts an 8-bit value (0–255) for PWM output.'
          : 'Not quite. Remember that the Uno measures the analogue input with a 10-bit ADC, then analogWrite() uses an 8-bit PWM command.';
      });
    });
  }

  const year = $('sl-year');
  if (year) year.textContent = String(new Date().getFullYear());
})();