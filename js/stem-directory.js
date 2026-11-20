/* Electronics Fundamentals directory search and category filtering. */
(() => {
  'use strict';
  const search = document.getElementById('sl-module-search');
  const category = document.getElementById('sl-category-filter');
  const clear = document.getElementById('sl-clear-filters');
  const grid = document.getElementById('sl-module-grid');
  const count = document.getElementById('sl-module-count');
  const empty = document.getElementById('sl-no-results');
  if (!search || !category || !clear || !grid || !count || !empty) return;

  const cards = Array.from(grid.querySelectorAll('.sl-path-card'));
  const total = cards.length;
  const normalise = value => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  function applyFilters() {
    const term = normalise(search.value);
    const selected = category.value;
    let visible = 0;
    cards.forEach(card => {
      const categoryMatches = selected === 'all' || card.dataset.category === selected;
      const textMatches = !term || normalise(card.textContent).includes(term);
      const show = categoryMatches && textMatches;
      card.hidden = !show;
      if (show) visible++;
    });
    count.textContent = 'Showing ' + visible + ' of ' + total + ' modules';
    empty.hidden = visible !== 0;
  }

  search.addEventListener('input', applyFilters);
  category.addEventListener('change', applyFilters);
  clear.addEventListener('click', () => {
    search.value = '';
    category.value = 'all';
    applyFilters();
    search.focus();
  });
  applyFilters();
})();