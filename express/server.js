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
const sha1 = require('sha1');
const request = require('request-promise');
const axios = require('axios');
const querystring = require('querystring')

const apiKey = process.env.SHOPIFY_API_KEY; // Netlify environment variable
const apiSecret = process.env.SHOPIFY_API_SECRET; // Netlify environment variable
const accessToken = process.env.SHOPIFY_API_ACCESS_TOKEN; // Netlify environment variable
const privateKey = new NodeRSA(process.env.PRIVATE_KEY).exportKey(); // Netlify environment variable
const RSAPrivateKey = new NodeRSA(process.env.RSA_PRIVATE_KEY).exportKey(); // Netlify environment variable

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
  // iPizza signing function
  const signer = crypto.createSign('RSA-SHA1')
  signer.update(macString)
  const signature = signer.sign(RSAPrivateKey, 'base64')

  return signature
}

router.get('/coflink', (req, res) => {
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
  const VK_DATETIME = moment().tz('Europe/Tallinn').format()
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

  axios({
    method: 'POST',
    url: 'https://www.lhv.ee/coflink',
    data: querystring.stringify(testRequest ? {testRequest: true, ...body} : body)
  })
    .then(function (response) {
      res.redirect(response.request.res.responseUrl) // how secure is using response.request.res.responseUrl

      // res.status(200).end(response.data)
    })

  // request({
  //   method: 'POST',
  //   uri: 'https://www.lhv.ee/coflink',
  //   form: {testRequest: true, ...body},
  //   followAllRedirects: true
  // })
  //   .then((body) => {
  //     console.log('success', body)
  //     res.status(200).end(body)
  //   })
  //   .catch((err) => {
  //     console.log('error', err)
  //     res.status(err.statusCode).send(err.message)
  //   })
})

router.post('/lhv-response', (req, res) => {
  console.log('post response', {req, res})

  console.log(req.query)
  return res.status(200).send(req.query)
})

app.use(bodyParser.json());
app.use('/.netlify/functions/server', router);  // path must route to lambda
app.use('/', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));

module.exports = app;
module.exports.handler = serverless(app);
