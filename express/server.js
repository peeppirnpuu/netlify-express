'use strict';
const dotenv = require('dotenv').config();
const express = require('express');
const path = require('path');
const serverless = require('serverless-http');
const app = express();
const router = express.Router();
const bodyParser = require('body-parser');
const moment = require('moment');
const url = require('url');
const crypto = require('crypto');
const NodeRSA = require('node-rsa');
const sha1 = require('sha1');
const uuidv4 = require('uuid/v4');
const request = require('request-promise');

const apiKey = process.env.SHOPIFY_API_KEY; // Netlify environment variable
const apiSecret = process.env.SHOPIFY_API_SECRET; // Netlify environment variable
const accessToken = process.env.SHOPIFY_API_ACCESS_TOKEN; // Netlify environment variable
const privateKey = process.env.PRIVATE_KEY; // Netlify environment variable

const lpad = (value, padding) => {
  if (value.toString().length >= padding) return value

  var zeroes = new Array(padding+1).join("0")
  return (zeroes + value).slice(-padding)
}

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

router.get('/lhv', (req, res) => {
  const key = new NodeRSA(privateKey)
  const { n, d } = key.exportKey('components')

  const datetime = new Date()

  const VK_SERVICE = '5011'
  const VK_VERSION = '008'
  const VK_SND_ID = 'Craftory123'
  const VK_REC_ID = 'LHV'
  const VK_STAMP = uuidv4()
  const VK_DATA =
    `<CofContractProductList>`+
      `<CofContractProduct>`+
        `<Name>Great Sack</Name>`+
        `<Code>1122</Code>`+
        `<Currency>EUR</Currency>`+
        `<CostInclVatAmount>55100</CostInclVatAmount>`+
        `<CostVatPercent>20</CostVatPercent>`+
      `</CofContractProduct>`+
      `<ValidToDtime>2019-10-05T14:35:00+03:00</ValidToDtime>`+
    `</CofContractProductList>`
  const VK_RESPONSE = 'https://api.craftory.com/lhv-response'
  const VK_RETURN = 'https://craftory.com/'
  const VK_DATETIME = moment(datetime).format()
  let VK_MAC = '' // not required in RSA calculation
  const VK_ENCODING = 'UTF-8' // not required in RSA calculation
  const VK_LANG = 'EST' // not required in RSA calculation
  const VK_EMAIL = 'peep.pirnpuu+test@gmail.com'
  const VK_PHONE = ''

  const signatureBody = [
    VK_SERVICE,
    VK_VERSION,
    VK_SND_ID,
    VK_REC_ID,
    VK_STAMP,
    VK_DATA,
    VK_RESPONSE,
    VK_RETURN,
    VK_DATETIME,
    VK_EMAIL,
    VK_PHONE
  ]

  signatureBody.map(value => {
    VK_MAC = VK_MAC + lpad(value.length, 3) + value
  })

  VK_MAC = sha1(VK_MAC)
  VK_MAC = key.sign(`${VK_MAC}, ${d}, ${n}`, 'base64', 'utf8')

  const uri = 'https://www.lhv.ee/coflink'
  const body = {
    VK_SERVICE,
    VK_VERSION,
    VK_SND_ID,
    VK_REC_ID,
    VK_STAMP,
    VK_DATA,
    VK_RESPONSE,
    VK_RETURN,
    VK_DATETIME,
    VK_MAC,
    VK_ENCODING,
    VK_LANG,
    VK_EMAIL,
    VK_PHONE
  }

  console.log({body})

  res.redirect(url.format({
    pathname: uri,
    query: body
  }))
})

router.get('/lhv-response', (req, res) => {
  console.log(req.query)
  return res.status(200).send(req.query)
})

app.use(bodyParser.json());
app.use('/.netlify/functions/server', router);  // path must route to lambda
app.use('/', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));

module.exports = app;
module.exports.handler = serverless(app);
