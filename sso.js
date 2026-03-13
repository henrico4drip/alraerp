const express = require('/home/deploy/alra/backend/node_modules/express');
const http = require('http');
const app = express();

app.get('/sso', (req, res) => {
  const { key } = req.query;
  if (key !== 'whatstalk') return res.status(403).send('Forbidden');

  const postData = JSON.stringify({ email: 'admin@admin.com', password: '123456' });

  const options = {
    hostname: '127.0.0.1',
    port: 3100,
    path: '/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const apiReq = http.request(options, (apiRes) => {
    let body = '';
    apiRes.on('data', (chunk) => { body += chunk; });
    apiRes.on('end', () => {
      try {
        const data = JSON.parse(body);

        // Forward the Set-Cookie header from the real backend
        const setCookieHeader = apiRes.headers['set-cookie'];
        if (setCookieHeader) {
          res.setHeader('Set-Cookie', setCookieHeader);
        }

        const token = data.token;
        const user = data.user || {};

        // IMPORTANT: token is stored RAW (no JSON.stringify) because
        // the React app reads it with localStorage.getItem('token') directly
        res.send(`
                    <html>
                    <body style="background:#1a1a2e;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
                        <div style="text-align:center;"><h2>Entrando no CRM...</h2></div>
                        <script>
                            localStorage.clear();
                            localStorage.setItem('token', '${token}');
                            localStorage.setItem('companyId', '${user.companyId || 1}');
                            localStorage.setItem('userId', '${user.id || 1}');
                            localStorage.setItem('username', '${user.name || "Henrico"}');
                            localStorage.setItem('profile', '${user.profile || "admin"}');
                            window.location.replace('/tickets');
                        </script>
                    </body>
                    </html>
                `);
      } catch (e) {
        res.status(500).send('Erro no login: ' + e.message + ' body: ' + body);
      }
    });
  });

  apiReq.on('error', (e) => {
    res.status(500).send('Erro de conexao: ' + e.message);
  });

  apiReq.write(postData);
  apiReq.end();
});

app.get('/sso-logout', (req, res) => {
  res.clearCookie('jrt');
  res.send(`
        <html><body><script>
            localStorage.clear();
            window.location.href = '/login';
        </script></body></html>
    `);
});

const PORT = 8081;
app.listen(PORT, () => console.log('SSO service running on port ' + PORT));
