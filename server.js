
require('dotenv').config();

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error('Supabase environment variables are missing!');
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);

app.get('/api/status', (req, res) => {
    res.json({
        server: 'Running',
        supabase: 'Client configured'
    });
});

module.exports = app;
