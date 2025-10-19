const Contact = require('../model/contact.model');
const nodemailer = require('nodemailer');

const submitContactForm = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Please fill in all fields.' });
    }

    const contact = new Contact({ name, email, subject, message });
    await contact.save();

    // Send email notification
    const transporter = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_FROM,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });


    const mailOptions = {
      from: `${name} <${process.env.EMAIL_FROM}>`,
      to: 'support@devkronsoft.com',
      subject: `New Contact Form Submission: ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\nMessage: ${message}`,
      replyTo: email
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({ message: 'Message sent successfully and email notification delivered.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong.' });
  }
};

module.exports = { submitContactForm };