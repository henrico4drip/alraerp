const http = require('http');
const { exec } = require('child_process');
require('dotenv').config({ path: '../.env' });

const PORT = 3334;

const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                console.log(`[WEBHOOK] Received event: ${data.event} for instance: ${data.instance}`);

                // Evento: connection.update (State: OPEN)
                if (data.event === 'connection.update' && data.data?.status === 'open') {
                    console.log(`>>> Instance ${data.instance} is now OPEN. Triggering historical sync...`);

                    // Trigger sync script in background
                    exec(`node autosync.js ${data.instance}`, (err, stdout, stderr) => {
                        if (err) console.error(`[SYNC ERROR] ${data.instance}:`, err);
                        else console.log(`[SYNC SUCCESS] ${data.instance}:\n`, stdout);
                    });
                }
            } catch (e) {
                console.error('Error parsing webhook:', e.message);
                console.error('Raw Body:', body);
            }
            res.end('ok');
        });
    } else {
        res.end('Evolution Webhook Listener is running');
    }
});

server.listen(PORT, () => {
    console.log(`>>> Evolution Webhook Listener running on port ${PORT}`);
    console.log(`>>> Set your Evolution Global Webhook to: http://SERVER_IP:${PORT}`);
});
