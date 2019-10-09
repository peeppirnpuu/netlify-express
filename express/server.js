'use strict';
const dotenv = require('dotenv').config();
const express = require('express');
const path = require('path');
const serverless = require('serverless-http');
const app = express();
const router = express.Router();
const bodyParser = require('body-parser');
const moment = require('moment-timezone')
const crypto = require('crypto');
const NodeRSA = require('node-rsa');
const request = require('request-promise');

const apiKey = process.env.SHOPIFY_API_KEY; // Netlify environment variable
const apiSecret = process.env.SHOPIFY_API_SECRET; // Netlify environment variable
const accessToken = process.env.SHOPIFY_API_ACCESS_TOKEN; // Netlify environment variable
const privateKey = process.env.SERVER_PRIVATE_KEY; // Netlify environment variable

const lpad = (value, padding) => {
  if (value.toString().length >= padding) return value

  var zeroes = new Array(padding+1).join("0")
  return (zeroes + value).slice(-padding)
}

const getMac = (body) => {
  let mac = ''

  body.map(value => {
    mac = mac + lpad(value.length, 3) + value
  })

  return mac
}

const signMac = (macString) => {
  const key = new NodeRSA(privateKey, 'pkcs8') // Import non-RSA private key
  const RSAPrivateKey = key.exportKey('pkcs1') // Export RSA private key

  // iPizza signing method
  const signer = crypto.createSign('RSA-SHA1')
  signer.update(macString)
  const signature = signer.sign(RSAPrivateKey, 'base64')

  return signature
}

router.get('/lhv', (req, res) => {
  const { testRequest } = req.query

  const VK_SERVICE = '5011'
  const VK_VERSION = '008'
  const VK_SND_ID = 'Craftory123'
  const VK_REC_ID = 'LHV'
  const VK_STAMP = '1234567890'
  const VK_DATA =
    `<CofContractProductList>`+
      `<CofContractProduct>`+
        `<Name>Great Sack</Name>`+
        `<Code>1122</Code>`+
        `<Currency>EUR</Currency>`+
        `<CostInclVatAmount>55100</CostInclVatAmount>`+
        `<CostVatPercent>20</CostVatPercent>`+
      `</CofContractProduct>`+
      `<ValidToDtime>2019-10-20T14:35:00+03:00</ValidToDtime>`+
    `</CofContractProductList>`
  const VK_RESPONSE = 'https://api.craftory.com/lhv-response'
  const VK_RETURN = 'https://craftory.com/'
  const VK_DATETIME = moment().tz('Estonia/Tallinn').format()
  let VK_MAC = '' // not required in RSA calculation
  const VK_ENCODING = 'UTF-8' // not required in RSA calculation
  const VK_LANG = 'EST' // not required in RSA calculation
  const VK_EMAIL = 'peep.pirnpuu+test@gmail.com'
  const VK_PHONE = ''

  const mac = getMac([
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
  ])

  VK_MAC = signMac(mac)

  const uri = 'https://www.lhv.ee/coflink'
  let body = {
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

  const options = {
    method: 'POST',
    uri,
    form: testRequest ? {testRequest: true, ...body} : body
  }

  console.log({options})

  request(options)
  .then((parsedBody) => {
    console.log('success')
    res.status(200).end(parsedBody)
  })
  .catch((error) => {
    console.log('error', error)
    res.status(error.statusCode).send(error.message)
  })
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
