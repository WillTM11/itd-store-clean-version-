const nodemailer = require('nodemailer');
const dns = require('dns');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT || 587),
  secure: String(process.env.MAIL_SECURE).toLowerCase() === 'true',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  },
  family: 4
});

async function sendOrderEmails({ order, items }) {
  const from = process.env.MAIL_FROM || process.env.MAIL_USER;
  const storeEmail = process.env.STORE_NOTIFY_EMAIL || process.env.MAIL_USER;

  const itemsHtml = items.map(i => `
    <tr>
      <td style="padding:6px 12px 6px 0;">${i.name}</td>
      <td style="padding:6px 12px 6px 0;">${i.size}</td>
      <td style="padding:6px 12px 6px 0;">${i.qty}</td>
      <td style="padding:6px 0;">£${(Number(i.price) * Number(i.qty)).toFixed(2)}</td>
    </tr>
  `).join('');

  const customerHtml = `
    <h2>Thanks for your order, ${order.full_name}.</h2>
    <p>Your order <strong>#${order.id}</strong> has been confirmed.</p>
    <p>Total: <strong>£${Number(order.total).toFixed(2)}</strong></p>

    <h3>Items</h3>
    <table style="border-collapse:collapse;">
      <tr>
        <th style="text-align:left;padding-right:20px;">Product</th>
        <th style="text-align:left;padding-right:20px;">Size</th>
        <th style="text-align:left;padding-right:20px;">Qty</th>
        <th style="text-align:left;">Line Total</th>
      </tr>
      ${itemsHtml}
    </table>

    <h3>Delivery Address</h3>
    <p>
      ${order.address1}<br>
      ${order.address2 ? `${order.address2}<br>` : ''}
      ${order.city}<br>
      ${order.postcode}
    </p>

    <p>We’ll email you again if there are any updates to your order.</p>
  `;

  const storeHtml = `
    <h2>New paid order received</h2>
    <p><strong>Order:</strong> #${order.id}</p>
    <p><strong>Name:</strong> ${order.full_name}</p>
    <p><strong>Email:</strong> ${order.email}</p>
    <p><strong>Total:</strong> £${Number(order.total).toFixed(2)}</p>

    <h3>Items</h3>
    <table style="border-collapse:collapse;">
      <tr>
        <th style="text-align:left;padding-right:20px;">Product</th>
        <th style="text-align:left;padding-right:20px;">Size</th>
        <th style="text-align:left;padding-right:20px;">Qty</th>
        <th style="text-align:left;">Line Total</th>
      </tr>
      ${itemsHtml}
    </table>

    <h3>Delivery Address</h3>
    <p>
      ${order.address1}<br>
      ${order.address2 ? `${order.address2}<br>` : ''}
      ${order.city}<br>
      ${order.postcode}
    </p>

    ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
  `;

  await transporter.sendMail({
    from,
    to: order.email,
    subject: `Your ITD Clothing order #${order.id}`,
    html: customerHtml
  });

  await transporter.sendMail({
    from,
    to: storeEmail,
    subject: `New paid order #${order.id}`,
    html: storeHtml
  });
}

module.exports = {
  transporter,
  sendOrderEmails
};