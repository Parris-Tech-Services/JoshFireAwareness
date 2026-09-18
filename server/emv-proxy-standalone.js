// Simple EMV proxy for local development
// Usage: node emv-proxy-standalone.js
// Listens on http://localhost:3000/api/emv and proxies EMV JSON with CORS

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;
const TARGET = 'https://data.emergency.vic.gov.au/Show?pageId=getIncidentJSON';

function proxyHandler(req, res) {
  const parsed = url.parse(req.url, true);
  if (!parsed.pathname.startsWith('/api/emv')) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const options = url.parse(TARGET);
  options.headers = { 'User-Agent': 'JoshFireAwareness-proxy/1.0' };

  https.get(options, (proxRes) => {
    const chunks = [];
    proxRes.on('data', (c) => chunks.push(c));
    proxRes.on('end', () => {
      const body = Buffer.concat(chunks);
      // Return with permissive CORS for local testing
      res.writeHead(200, {
        'Content-Type': proxRes.headers['content-type'] || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET'
      });
      res.end(body);
    });
  }).on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Upstream fetch error');
  });
}

const server = http.createServer(proxyHandler);
server.listen(PORT, () => {
  console.log(`EMV proxy listening on http://localhost:${PORT}/api/emv`);
});
