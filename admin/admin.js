class AdminPanel {
  constructor() {
    this.form = document.getElementById('settingsForm');
    this.settings = {};
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.populateForm();
    this.attachListeners();
  }

  async loadSettings() {
    try {
      const response = await fetch('../data/settings.json');
      this.settings = await response.json();
    } catch (error) {
      console.log('Using default settings');
      this.settings = this.getDefaultSettings();
    }
  }

  getDefaultSettings() {
    return {
      primaryColor: '#0A2540',
      accentColor: '#00C853',
      logoLight: 'https://via.placeholder.com/180x180/0A2540/00C853?text=EazyLife',
      logoDark: 'https://via.placeholder.com/180x180/ffffff/00C853?text=EazyLife',
      faviconLight: '🚀',
      faviconDark: '🚀',
      tagline: 'Integrity & Affordability in Every Device',
      whatsapp: '2347051548082',
      aboutText: 'We are an Ibadan-based technology company...',
    };
  }

  populateForm() {
    Object.keys(this.settings).forEach(key => {
      const input = document.getElementById(key);
      if (input) {
        input.value = this.settings[key];
      }
    });
    this.updateColorPreviews();
    this.updateLogoPreviews();
  }

  updateColorPreviews() {
    document.getElementById('primaryPreview').style.background = document.getElementById('primaryColor').value;
    document.getElementById('accentPreview').style.background = document.getElementById('accentColor').value;
  }

  updateLogoPreviews() {
    const logoLight = document.getElementById('logoLight').value;
    const logoDark = document.getElementById('logoDark').value;
    
    const preview = document.getElementById('logoPreview');
    preview.innerHTML = `
      <div class="preview-item">
        <h3>Light Mode</h3>
        <img src="${logoLight}" alt="Light Logo" onerror="this.src='https://via.placeholder.com/150?text=Logo'">
      </div>
      <div class="preview-item">
        <h3>Dark Mode</h3>
        <img src="${logoDark}" alt="Dark Logo" onerror="this.src='https://via.placeholder.com/150?text=Logo'">
      </div>
    `;
  }

  async saveSettings(e) {
    e.preventDefault();
    
    const formData = new FormData(this.form);
    const newSettings = Object.fromEntries(formData);

    try {
      // In a real application, you'd send this to a backend
      // For now, we'll save to localStorage
      localStorage.setItem('eazylife_settings', JSON.stringify(newSettings));
      
      this.showMessage('✅ Settings saved successfully!', 'success');
      
      // Update parent window
      setTimeout(() => {
        window.location.href = '../index.html';
      }, 1500);
    } catch (error) {
      this.showMessage('❌ Error saving settings: ' + error.message, 'error');
    }
  }

  showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    
    setTimeout(() => {
      messageDiv.className = 'message';
    }, 5000);
  }

  attachListeners() {
    this.form.addEventListener('submit', (e) => this.saveSettings(e));
    document.getElementById('primaryColor').addEventListener('change', () => this.updateColorPreviews());
    document.getElementById('accentColor').addEventListener('change', () => this.updateColorPreviews());
    document.getElementById('logoLight').addEventListener('change', () => this.updateLogoPreviews());
    document.getElementById('logoDark').addEventListener('change', () => this.updateLogoPreviews());
  }
}

const adminPanel = new AdminPanel();
