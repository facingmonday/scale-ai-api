const sgMail = require('@sendgrid/mail');
const sgClient = require('@sendgrid/client');

const sendGridApiKey = process.env.SENDGRID_API_KEY;

if (!sendGridApiKey) {
  console.warn('⚠️  SENDGRID_API_KEY is not set in environment variables. Email sending will fail.');
} else {
  sgClient.setApiKey(sendGridApiKey);
  sgMail.setApiKey(sendGridApiKey);
}

module.exports = {
  sgMail,
  sgClient
};