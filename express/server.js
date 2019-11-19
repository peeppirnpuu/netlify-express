'use strict';
const fs = require('fs')
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
// const querystring = require('querystring'); // formerly used by axios
const queryString = require('query-string');
const convert = require('xml-js');
const nodemailer = require('nodemailer');

const apiKey = process.env.SHOPIFY_API_KEY; // Netlify environment variable
const apiSecret = process.env.SHOPIFY_API_SECRET; // Netlify environment variable
const accessToken = process.env.SHOPIFY_API_ACCESS_TOKEN; // Netlify environment variable
const privateKey = new NodeRSA(process.env.PRIVATE_KEY).exportKey(); // Netlify environment variable
const RSAPrivateKey = new NodeRSA(process.env.RSA_PRIVATE_KEY).exportKey(); // Netlify environment variable
const mailUsername = new NodeRSA(process.env.MAIL_USERNAME).exportKey(); // Netlify environment variable
const mailPassword = new NodeRSA(process.env.MAIL_PASSWORD).exportKey(); // Netlify environment variable
const mailFrom = new NodeRSA(process.env.MAIL_FROM).exportKey(); // Netlify environment variable
const mailRecipient = new NodeRSA(process.env.MAIL_RECIPIENT).exportKey(); // Netlify environment variable

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

const getParams = (query) => {
  const { testRequest, order, total, email, phone, returnUrl } = query

  const VK_SERVICE = '5011'
  const VK_VERSION = '008'
  const VK_SND_ID = 'Craftory123'
  const VK_REC_ID = 'LHV'
  const VK_STAMP = order || ''
  const VK_DATA =
    `<CofContractProductList>`+
      `<CofContractProduct>`+
        `<Name>Tellimus nr ${order || ''}</Name>`+
        `<Code></Code>`+
        `<Currency>EUR</Currency>`+
        `<CostInclVatAmount>${total || 0}</CostInclVatAmount>`+
        `<CostVatPercent>20</CostVatPercent>`+
      `</CofContractProduct>`+
      `<ValidToDtime>${moment(Date.now() + 7 * 24 * 3600 * 1000).tz('Europe/Tallinn').format()}</ValidToDtime>`+
    `</CofContractProductList>`
  const VK_RESPONSE = 'https://api.craftory.com/.netlify/functions/server/coflink/response' // 'https://craftory.com/tools/lhv/coflink/response'
  const VK_RETURN = returnUrl || 'https://craftory.com'
  const VK_DATETIME = moment().tz('Europe/Tallinn').format()
  let VK_MAC = '' // not required in RSA calculation
  const VK_ENCODING = 'UTF-8' // not required in RSA calculation
  const VK_LANG = 'EST' // not required in RSA calculation
  const VK_EMAIL = email || ''
  const VK_PHONE = phone || ''

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

  return testRequest ? {testRequest: true, ...body} : body
}

router.get('/', (req, res) => {
  return res.status(200).send('')
})

router.get('/axios', (req, res) => {
  const params = getParams(req.query)

  axios({
    method: 'POST',
    url: 'https://www.lhv.ee/coflink',
    data: querystring.stringify(params)
  })
    .then(function (response) {
      res.redirect(response.request.res.responseUrl) // how secure is using response.request.res.responseUrl

      // res.status(200).end(response.data)
    })
})

router.get('/request', (req, res) => {
  const params = getParams(req.query)

  request({
    method: 'POST',
    uri: 'https://www.lhv.ee/coflink',
    form: params,
    followAllRedirects: true
  })
    .then((body) => {
      console.log('success', body)
      res.status(200).end(body)
    })
    .catch((err) => {
      console.log('error', err)
      res.status(err.statusCode).send(err.message)
    })
})

router.get('/form', (req, res) => {
  console.log('get /form')

  const contents = fs.readFileSync('/form.html', 'utf8')

  res.status(200).end(contents)
})

router.get('/coflink', (req, res) => {
  const params = getParams(req.query)

  console.log('get /coflink', {params})

  res.status(200).end(JSON.stringify(params))
})

router.post('/coflink/response', (req, res) => {
  const body = queryString.parse(req.body.toString())
  console.log('post /coflink/response body', body)

  const data = JSON.parse(convert.xml2json(body.VK_DATA, {compact: true}))
  console.log('post /coflink/response data', data)

  let loanDecision = ''
  let loanDetails = {}

  if (body.VK_SERVICE === '5111') {
    loanDecision = 'Õnnestunud laenutaotlus'

    loanDetails = {
      tellimus: body.VK_STAMP,
      taotlus: data.CoflinkContract.ContractNumber['_text'],
      kliendi_email: data.CoflinkContract.CustomerEmail['_text'],
      kliendi_telefon: data.CoflinkContract.CustomerPhone['_text']
    }
  } else
  if (body.VK_SERVICE === '5113') {
    loanDecision = 'Ebaõnnestunud laenutaotlus'

    loanDetails = {
      tellimus: body.VK_STAMP
    }
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: mailUsername,
      pass: mailPassword
    }
  })

  const mailOptions = {
    from: mailFrom,
    to: mailRecipient,
    subject: loanDecision,
    text: JSON.stringify(loanDetails)
  }

  transporter.sendMail(mailOptions, function(error, info) {
    if (error) {
      console.log(error)
    } else {
      console.log('Email sent: '+info.response)
    }
  })

  return res.status(200).send(loanDecision)
  // return res.redirect('http://craftory.com')
  // response.writeHead(301, {Location: 'https://craftory.com'})
  // response.end()
})

app.use(bodyParser.json());
app.use('/.netlify/functions/server', router);  // path must route to lambda
app.use('/', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));

module.exports = app;
module.exports.handler = serverless(app);
