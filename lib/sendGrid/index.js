const sgMail = require('@sendgrid/mail');
const sgClient = require('@sendgrid/client');

const sendGridApiKey = process.env.SENDGRID_API_KEY;
sgClient.setApiKey(sendGridApiKey);
sgMail.setApiKey(sendGridApiKey);

module.exports = {
  sgMail,
  sgClient
};