const nodemailer = require('nodemailer');
module.exports = async function sendMail(content, title, emailTo) {
    let transporter = nodemailer.createTransport({
      host: 'mail.google.com',
      service: "Gmail",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: 'duminhtat98@gmail.com', // generated ethereal user
        pass: 'tatminhdu98' // generated ethereal password
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  
    // send mail with defined transport object
    let info = await transporter.sendMail({
      from: `"${title}" <foo@example.com>`, // sender address
      to: `World Traveler, ${emailTo}`, // list of receivers
      subject: 'World Traveler', // Subject line
      text: 'Hello world?', // plain text body
      html: content // html body
    });
  
    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  }