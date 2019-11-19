const mailUsername = process.env.MAIL_USERNAME; // Netlify environment variable
const mailPassword = process.env.MAIL_PASSWORD; // Netlify environment variable
const mailFrom = process.env.MAIL_FROM; // Netlify environment variable
const mailTo = process.env.MAIL_TO; // Netlify environment variable

 exports.handler = function(event, context, callback) {

  	var nodemailer = require('nodemailer');
  	var smtpTransport = require('nodemailer-smtp-transport');

  	var transporter = nodemailer.createTransport(smtpTransport({
	    service: 'gmail',
	    auth: {
	        user: mailUsername,
	        pass: mailPassword
	    }
  	}));

  	var text = 'Email body goes here';

  	var mailOptions = {
	    from: mailFrom,
	    to: mailTo,
	    subject: 'Test subject',
	    text: text
  	};

  	transporter.sendMail(mailOptions, function(error, info){
      if(error){
        const response = {
          statusCode: 500,
          body: JSON.stringify({
            error: error.message,
          }),
        };
        callback(null, response);
      }
      const response = {
        statusCode: 200,
        body: JSON.stringify({
          message: `Email processed succesfully!`
        }),
      };
      callback(null, response);
    });
}
