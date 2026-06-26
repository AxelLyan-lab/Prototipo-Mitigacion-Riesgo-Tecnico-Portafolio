const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
globalThis.WebSocket = WebSocket;
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder', {
  auth: { persistSession: false }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Sistema de Patrullaje Backend is running' });
});

// Example endpoint to get mock delicts
app.get('/api/delitos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('eventos_delictuales_mock')
      .select('*');
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
