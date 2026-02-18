const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gxevfegraewgyuravnbp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4ZXZmZWdyYWV3Z3l1cmF2bmJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzI1NzMsImV4cCI6MjA4NjkwODU3M30.ChQNooeJvbBZF4qOpOJtB92tfYszRJiRay8G_W0nnhI';
const COBRANZA_NUMBER = process.env.COBRANZA_NUMBER || '56912345678'; // Replace with real number

// Dummy server for Render Web Service (Free Tier)
const http = require('http');
const port = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('WhatsApp Bot is running\n');
});
server.listen(port, () => {
    console.log(`Server running at port ${port}`);
});


// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Initialize WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // <- this one doesn't works in Windows
            '--disable-gpu'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    }
});

client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.generate(qr, { small: true });
    console.log('Please scan the QR code with WhatsApp to log in.');
});

client.on('ready', () => {
    console.log('Client is ready!');
    checkExpirationsAndSend();

    // Schedule daily check (e.g., every 24 hours)
    // setInterval(checkExpirationsAndSend, 24 * 60 * 60 * 1000);
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
});

async function checkExpirationsAndSend() {
    console.log('Checking for expiring quotes...');
    const today = new Date().toISOString().split('T')[0];

    try {
        const { data: quotes, error } = await supabase
            .from('quotes')
            .select('*')
            .eq('expiration_date', today)
            .not('status', 'in', '("Pagada","Rechazada","Cerrada")');

        if (error) throw error;

        if (quotes && quotes.length > 0) {
            console.log(`Found ${quotes.length} expiring quotes.`);
            let message = `*REPORTE AUTOMÁTICO - ${new Date().toLocaleDateString('es-CL')}*\n`;
            message += `Se han detectado ${quotes.length} cotizaciones que vencen hoy:\n\n`;

            quotes.forEach((q, index) => {
                message += `${index + 1}. *#${q.id}* - ${q.client}\n`;
                message += `   Monto: $${(q.total || 0).toLocaleString('es-CL')}\n\n`;
            });

            message += `Favor gestionar.`;

            const chatId = `${COBRANZA_NUMBER}@c.us`; // WhatsApp ID format
            await client.sendMessage(chatId, message);
            console.log('Message sent to collections number.');
        } else {
            console.log('No expiring quotes found for today.');
        }

    } catch (err) {
        console.error('Error checking expirations:', err);
    }
}

client.initialize();
