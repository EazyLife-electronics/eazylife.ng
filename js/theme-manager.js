class ThemeManager {
    constructor() {
        this.currentTheme = 'light'; // Default theme
    }

    setTheme(theme) {
        if (['light', 'dark'].includes(theme)) {
            this.currentTheme = theme;
            this.applyTheme();
            console.log(`Theme switched to: ${theme}`);
        } else {
            console.error(`Theme ${theme} is not supported.`);
        }
    }

    applyTheme() {
        document.body.className = this.currentTheme;
    }

    getCurrentTheme() {
        return this.currentTheme;
    }
}

// Example usage:
// const themeManager = new ThemeManager();
// themeManager.setTheme('dark');