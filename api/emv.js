// Vercel serverless function: /api/emv
// Deploy this file under a Vercel project root `api/emv.js`.

const https = require('https');

const TARGET = 'https://data.emergency.vic.gov.au/Show?pageId=getIncidentJSON';

module.exports = async (req, res) => {
  try {
    https.get(TARGET, (proxRes) => {
      const chunks = [];
      proxRes.on('data', (c) => chunks.push(c));
      proxRes.on('end', () => {
        const body = Buffer.concat(chunks);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Content-Type', proxRes.headers['content-type'] || 'application/json');
        res.status(200).send(body);
      });
    }).on('error', (err) => {
      res.status(502).send('Upstream fetch error');
    });
  } catch (e) {
    res.status(500).send('Proxy internal error');
  }
};
