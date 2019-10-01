'use strict';
const express = require('express');
const path = require('path');
const serverless = require('serverless-http');
const app = express();
const router = express.Router();
const bodyParser = require('body-parser');
const crypto = require('crypto');
const request = require('request-promise');

const validateSignature = (query) => {
  var parameters = [];
  for (var key in query) {
    if (key != 'signature') {
      parameters.push(key + '=' + query[key])
    }
  }
  var message = parameters.sort().join('');
  var digest = crypto.createHmac('sha256', apiSecret).update(message).digest('hex');
  return digest === query.signature;
};

router.get('/', (req, res) => {
  res.send('Hello World!');
});

router.get('/products', (req, res) => {
  if (req.query && Object.keys(req.query).length) {
    const validSignature = validateSignature(req.query);

    if (validSignature) {
      const { shop } = req.query;

      const shopRequestUrl = 'https://' + shop + '/admin/api/2019-07/products.json';
      const shopRequestHeaders = {
        'X-Shopify-Access-Token': accessToken,
      };

      request.get(shopRequestUrl, { headers: shopRequestHeaders })
      .then((shopResponse) => {
        console.log('shopResponse', shopResponse);
        res.status(200).end(shopResponse);
      })
      .catch((error) => {
        res.status(error.statusCode).send(error.error.error_description);
      });
    } else {
      return res.status(400).send('Can not validate signature.');
    }
  } else {
    return res.status(400).send('Not valid request.');
  }
});

app.use(bodyParser.json());
app.use('/.netlify/functions/server', router);  // path must route to lambda
app.use('/', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));

module.exports = app;
module.exports.handler = serverless(app);
