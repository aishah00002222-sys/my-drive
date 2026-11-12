require('dotenv').config();

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const app = express();
const path = require('path');
const PORT = 3000;

// Check environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error('Supabase environment variables are missing!');
}

// Connect to Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
    res.send('Welcome to My Drive Backend!');
});

app.get('/api/status', (req, res) => {
    res.json({
        server: 'Running',
        supabase: 'Client configured'
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Supabase client initialized successfully!');
});