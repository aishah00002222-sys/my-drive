
require('dotenv').config();

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Check environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error('Supabase environment variables are missing!');
}

// Connect to Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Server status
app.get('/api/status', (req, res) => {
    res.json({
        server: 'Running',
        supabase: 'Client configured'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Supabase client initialized successfully!');
});
