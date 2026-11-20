/* EazyLife STEM Lab: component identification and polarity learning interactions. */
(() => {
  'use strict';
  const polarity = document.getElementById('polarity-select');
  if (polarity) {
    const led = document.getElementById('polarity-led');
    const state = document.getElementById('polarity-state');
    const feedback = document.getElementById('polarity-feedback');
    const update = () => {
      const mode = polarity.value;
      const on = mode === 'forward';
      led.style.opacity = on ? '1' : '.35';
      led.style.filter = on ? 'drop-shadow(0 0 16px #ff5555) brightness(1.2)' : 'none';
      if (on) {
        state.textContent = 'LED forward-biased';
        feedback.textContent = 'The LED is forward-biased. In a correctly designed low-voltage circuit, current can flow and the LED can emit light.';
      } else if (mode === 'reverse') {
        state.textContent = 'LED reverse-biased';
        feedback.textContent = 'The LED is reverse-biased. It normally does not light. Do not apply excessive reverse voltage; many LEDs have a low reverse-voltage rating.';
      } else {
        state.textContent = 'Open circuit';
        feedback.textContent = 'There is no complete current path, so the LED remains off even though its polarity may be correct.';
      }
    };
    polarity.addEventListener('change', update);
    update();
  }
  const quiz = document.getElementById('component-quiz');
  if (quiz) {
    quiz.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      quiz.querySelectorAll('button').forEach(item => { item.disabled = true; item.classList.remove('correct', 'incorrect'); });
      const correct = button.dataset.answer === 'true';
      button.classList.add(correct ? 'correct' : 'incorrect');
      document.getElementById('component-quiz-feedback').textContent = correct
        ? 'Correct. The band commonly marks the cathode on many axial diodes. Confirm the exact part marking and datasheet.'
        : 'Not quite. Many axial diodes have a band near the cathode end. Check the exact component documentation when uncertain.';
    }));
  }
  const year = document.getElementById('sl-year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
