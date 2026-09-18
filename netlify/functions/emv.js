// Netlify Function: netlify/functions/emv.js
// Deploy with Netlify Functions. Returns EMV JSON with permissive CORS for client access.

const https = require('https');

const TARGET = 'https://data.emergency.vic.gov.au/Show?pageId=getIncidentJSON';

exports.handler = async function (event, context) {
  return new Promise((resolve) => {
    https.get(TARGET, (proxRes) => {
      const chunks = [];
      proxRes.on('data', (c) => chunks.push(c));
      proxRes.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({
          statusCode: 200,
          headers: {
            'Content-Type': proxRes.headers['content-type'] || 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET'
          },
          body
        });
      });
    }).on('error', () => {
      resolve({ statusCode: 502, body: 'Upstream fetch error' });
    });
  });
};
