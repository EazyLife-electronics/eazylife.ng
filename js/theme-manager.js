class ThemeManager {
  constructor() {
    this.currentTheme = localStorage.getItem('theme') || 'light';
    this.settings = {};
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.applyTheme();
    this.attachListeners();
  }

  async loadSettings() {
    try {
      const response = await fetch('data/settings.json');
      this.settings = await response.json();
    } catch (error) {
      console.log('Using default settings');
      this.settings = this.getDefaultSettings();
    }
  }

  getDefaultSettings() {
    return {
      theme: 'light',
      logoLight: 'https://via.placeholder.com/180x180/0A2540/00C853?text=EazyLife',
      logoDark: 'https://via.placeholder.com/180x180/ffffff/00C853?text=EazyLife',
      faviconLight: '🚀',
      faviconDark: '🚀',
      primaryColor: '#0A2540',
      accentColor: '#00C853',
    };
  }

  applyTheme() {
    const theme = this.currentTheme;
    const logoImg = document.getElementById('logo');
    const favicon = document.getElementById('favicon');
    const themeLink = document.getElementById('theme-stylesheet');
    const toggle = document.getElementById('theme-toggle');

    // Apply logo
    logoImg.src = theme === 'dark' ? this.settings.logoDark : this.settings.logoLight;

    // Apply favicon
    favicon.href = theme === 'dark' ? this.settings.faviconDark : this.settings.faviconLight;

    // Apply theme CSS
    themeLink.href = theme === 'dark' ? 'css/dark-mode.css' : '';

    // Update toggle button
    toggle.textContent = theme === 'dark' ? '☀️' : '🌙';

    document.documentElement.setAttribute('data-theme', theme);
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', this.currentTheme);
    this.applyTheme();
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.applyTheme();
  }

  attachListeners() {
    document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
  }
}

// Initialize on page load
const themeManager = new ThemeManager();
