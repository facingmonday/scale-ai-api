const { sgMail } = require("./index");
const templateService = require("../template-service");
const { renderTemplate } = require("../emails/renderer");

/**
 * Send an email using SendGrid with React Email templates
 * @param {Object} emailData - The email data to send
 * @param {Object} emailData.to - The recipient email address(es)
 * @param {Object} emailData.subject - The email subject
 * @param {Object} emailData.from - The sender email address
 * @param {Object} emailData.html - The HTML content of the email (optional if templateId provided)
 * @param {String} emailData.templateSlug - Template slug to use (React Email component)
 * @param {Object} emailData.templateData - Data to render the template with
 * @param {String} emailData.organizationId - Optional organization ID for template lookup
 * @param {Boolean} emailData.populateTemplateData - Whether to automatically populate template data
 */
async function sendEmail(emailData) {
  // Validate emailData
  const requiredFields = ["to", "subject", "from"];
  const missingFields = requiredFields.filter((field) => !emailData[field]);
  if (missingFields.length > 0) {
    throw new Error(
      "Email data is missing required fields: " + JSON.stringify(missingFields)
    );
  }

  let html = emailData.html;
  let text = emailData.text;
  let templateData = emailData.templateData;

  const organizationId =
    emailData.organizationId ||
    (templateData?.organization && templateData.organization._id);

  // If templateId is provided, render using React Email
  if (emailData.templateSlug) {
    // Resolve template slug (handles both ObjectIds from old notifications and slugs from new notifications)
    const templateSlug = emailData.templateSlug;

    let reactProps = templateData || {};

    // If populateTemplateData is true and we have modelData, populate the data
    // This uses the template service to look up model metadata if available in the database
    if (emailData.populateTemplateData && emailData.modelData) {
      try {
        // Use template service to populate data
        const populatedModelData = await templateService.populateTemplateData(
          templateSlug,
          emailData.modelData,
          organizationId
        );
        reactProps = { ...templateData, ...populatedModelData };
      } catch (populateErr) {
        console.warn(
          `Template population failed for ${templateSlug}, using provided data:`,
          populateErr.message
        );
      }
    }

    // Render using React Email with the resolved slug
    try {
      const rendered = await renderTemplate(templateSlug, reactProps);
      html = rendered.html;
      text = rendered.text;
    } catch (reactErr) {
      console.error(
        `React Email rendering failed for ${templateSlug}:`,
        reactErr
      );
      throw new Error(
        `Failed to render email template ${templateSlug}: ${reactErr.message}`
      );
    }
  } else if (!html && !text) {
    throw new Error(
      "Either html, text, or templateId with templateData must be provided"
    );
  }

  if (process.env.SEND_EMAIL !== "true") {
    console.log("SEND_EMAIL is not set to 'true', skipping email send");
    console.log("Email would have been sent to:", emailData.to);
    return;
  }

  try {
    // Replace unsubscribe URL placeholders
    html = html
      ? html.replace(/%%UNSUBSCRIBE_URL%%/g, `{{unsubscribeurl}}`)
      : null;
    text = text
      ? text.replace(/%%UNSUBSCRIBE_URL%%/g, `{{unsubscribeurl}}`)
      : null;
  } catch (error) {
    console.error("Error replacing unsubscribe URL:", error);
  }

  // If we have multiple recipients, use bulk send
  if (Array.isArray(emailData.to)) {
    // Break into chunks of 1000 (SendGrid's recommended batch size)
    const BATCH_SIZE = 1000;
    const recipients = emailData.to;
    const batches = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      const batchEmail = {
        personalizations: batch.map((recipient) => ({
          to: [
            {
              email: recipient.email,
              name: recipient.name,
            },
          ],
          subject: emailData.subject,
          substitutions: {
            unsubscribeurl: `${process.env.SCALE_API_HOST}/${
              process.env.SCALE_API_VERSION
            }/sendgrid/unsubscribe?token=${
              recipient.memberId || recipient._id || recipient.email
            }`,
          },
        })),
        from: emailData.from,
        subject: emailData.subject,
        html: html,
        ...(text && { text: text }),
      };
      batches.push(batchEmail);
    }

    await Promise.all(batches.map((batch) => sgMail.send(batch)));
  } else {
    // Single recipient
    await sgMail.send({
      personalizations: [
        {
          to: [
            {
              email: emailData.to.email,
              name: emailData.to.name,
            },
          ],
          substitutions: {
            unsubscribeurl: `${
              process.env.SCALE_API_HOST
            }/api/sendgrid/unsubscribe?token=${
              emailData.to.memberId || emailData.to._id || emailData.to.email
            }`,
          },
        },
      ],
      from: emailData.from,
      subject: emailData.subject,
      html: html,
      ...(text && { text: text }),
    });
  }

  console.log(
    `✅ Email sent successfully to ${
      Array.isArray(emailData.to)
        ? emailData.to.length + " recipients"
        : emailData.to.email
    }`
  );
}

module.exports = {
  sendEmail,
};
