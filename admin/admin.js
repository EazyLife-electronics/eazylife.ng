class AdminPanel {
    constructor() {
        this.settings = {};
    }

    // Function to get a setting
    getSetting(key) {
        return this.settings[key] || null;
    }

    // Function to set a setting
    setSetting(key, value) {
        this.settings[key] = value;
    }

    // Function to remove a setting
    removeSetting(key) {
        delete this.settings[key];
    }

    // Function to get all settings
    getAllSettings() {
        return this.settings;
    }
}

export default AdminPanel;