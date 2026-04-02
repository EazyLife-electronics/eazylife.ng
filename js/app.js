// app.js - Application Initialization Logic

// Import necessary modules
const express = require('express');
const bodyParser = require('body-parser');

// Initialize the application
const app = express();

// Middleware
app.use(bodyParser.json());

// Define routes
app.get('/', (req, res) => {
    res.send('Welcome to EazyLife App!');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
