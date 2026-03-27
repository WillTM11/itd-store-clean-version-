console.log('✅ RUNNING THIS server.js FILE:', __filename);
console.log('✅ CWD:', process.cwd());

require('dotenv').config();

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const multer = require('multer');
const { transporter, sendOrderEmails } = require('./mail');


transporter.verify()
  .then(() => console.log('✅ Mail transporter ready'))
  .catch(err => console.error('❌ Mail transporter failed:', err.message));

if (!process.env.STRIPE_SECRET_KEY) {
  console.error(' Missing STRIPE_SECRET_KEY in .env');
}
if (!process.env.BASE_URL) {
  console.error(' Missing BASE_URL in .env');
}

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
if (!STRIPE_WEBHOOK_SECRET) {
  console.error(' Missing STRIPE_WEBHOOK_SECRET in .env');
}

const express = require('express');
const path = require('path');
const session = require('express-session');
const db = require('./models/db');

db.execute('SELECT 1')
  .then(() => console.log('DB connected successfully'))
  .catch(err => console.error('DB connection failed:', err));

db.execute('SELECT DATABASE() AS db')
  .then(([rows]) => console.log('✅ Node is using DB:', rows[0].db))
  .catch(console.error);

db.execute("SHOW COLUMNS FROM products LIKE 'active'")
  .then(([rows]) => console.log("✅ products.active column:", rows))
  .catch(err => console.error("❌ SHOW COLUMNS failed:", err.message));

db.execute("SHOW CREATE TABLE products")
  .then(([rows]) => console.log("✅ products table DDL:\n", rows[0]['Create Table']))
  .catch(err => console.error("❌ SHOW CREATE TABLE failed:", err.message));  

const app = express();

app.get('/webhook-test', (req, res) => {
  res.send('webhook route reachable');
});

/**
 * Stripe webhook MUST be declared BEFORE express.json()
 * and MUST use express.raw() for signature verification.
 */
app.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  console.log('🔥 /webhook HIT at', new Date().toISOString());
  console.log('✅ Is raw buffer:', Buffer.isBuffer(req.body));

  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('✅ Webhook received event:', event.type);

  try {
    if (event.type === 'checkout.session.completed') {
      const sessionObj = event.data.object;
      console.log('✅ session metadata:', sessionObj.metadata);

      const orderId = Number(sessionObj.metadata?.orderId);
      console.log('✅ webhook orderId:', orderId);

      if (!orderId) {
        console.log('⚠️ checkout.session.completed missing metadata.orderId');
        return res.json({ received: true });
      }

      const [orders] = await db.execute(
        'SELECT id, status FROM orders WHERE id = ?',
        [orderId]
      );

      console.log('✅ webhook orders lookup:', orders);

      if (!orders.length) {
        console.log(`⚠️ Order ${orderId} not found`);
        return res.json({ received: true });
      }

      if (orders[0].status === 'paid') {
        console.log(`ℹ️ Order ${orderId} already marked paid`);
        return res.json({ received: true });
      }

      const shipping = Number(sessionObj.total_details?.amount_shipping || 0) / 100;

await db.execute(
  'UPDATE orders SET status = ?, shipping = ? WHERE id = ?',
  ['paid', shipping, orderId]
);
      console.log(`✅ order ${orderId} marked paid`);

      const [items] = await db.execute(
        'SELECT product_id, qty FROM order_items WHERE order_id = ?',
        [orderId]
      );

      console.log('✅ webhook order items:', items);

      for (const item of items) {
        const [productRows] = await db.execute(
          'SELECT product_type FROM products WHERE id = ?',
          [item.product_id]
        );

        if (!productRows.length) continue;

        const productType = productRows[0].product_type;

        if (productType !== 'set') {
          const [result] = await db.execute(
            'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
            [item.qty, item.product_id, item.qty]
          );

          console.log(
            `single product stock update id=${item.product_id} qty=${item.qty}`,
            result.affectedRows
          );

          continue;
        }

        const [bundleItems] = await db.execute(
          `SELECT child_product_id, qty
           FROM product_bundle_items
           WHERE bundle_product_id = ?`,
          [item.product_id]
        );

        for (const bundleItem of bundleItems) {
          const reduceQty = item.qty * (bundleItem.qty || 1);

          const [result] = await db.execute(
            'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
            [reduceQty, bundleItem.child_product_id, reduceQty]
          );

          console.log(
            `set stock update child=${bundleItem.child_product_id} qty=${reduceQty}`,
            result.affectedRows
          );
        }
      }

      const [orderRows] = await db.execute(
        'SELECT * FROM orders WHERE id = ?',
        [orderId]
      );

      const [itemRows] = await db.execute(
        'SELECT * FROM order_items WHERE order_id = ?',
        [orderId]
      );

      if (orderRows.length) {
        try {
          await sendOrderEmails({
            order: orderRows[0],
            items: itemRows
          });
          console.log(`✅ Order emails sent for order ${orderId}`);
        } catch (mailErr) {
          console.error('❌ Email send failed:', mailErr);
        }
      }

      console.log(`✅ Webhook finished for order ${orderId}`);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('❌ Webhook handler error:', err);
    return res.status(500).send('Webhook handler failed');
  }
});

// --- MULTER UPLOAD SETUP ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'uploads')),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('Only image files are allowed'), ok);
  }
});

// Middleware (normal routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized:false
}));

// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// --- CART HELPERS ---
function getCart(req) {
  if (!req.session.cart) req.session.cart = [];
  return req.session.cart;
}

function cartTotal(cart) {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

// Pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/shop', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'shop.html'));
});

app.get('/product', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'product.html'));
});

app.get('/cart', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'cart.html'));
});

app.get('/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'checkout.html'));
});

app.get('/confirmation', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'confirmation.html'));
});

// API (cart)
app.get('/api/cart', (req, res) => {
  const cart = getCart(req);
  res.json({ cart, total: cartTotal(cart) });
});

// API (order by id)
app.get('/api/order', async (req, res) => {
  const orderId = Number(req.query.orderId);
  if (!orderId) return res.json(null);

  try {
    const [orders] = await db.execute(`SELECT * FROM orders WHERE id = ?`, [orderId]);
    if (!orders.length) return res.json(null);

    const [items] = await db.execute(`SELECT * FROM order_items WHERE order_id = ?`, [orderId]);

    res.json({ order: orders[0], items });
  } catch (err) {
    console.error('Order fetch error:', err);
    res.status(500).json(null);
  }
});

// --- ADMIN AUTH ---
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
}

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin-login.html'));
});

app.post('/admin/login', (req, res) => {
  const pw = String(req.body.password || '');

  if (!process.env.ADMIN_PASSWORD) {
    console.error('Missing ADMIN_PASSWORD in .env');
    return res.status(500).send('Admin not configured');
  }

  if (pw === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }

  return res.redirect('/admin/login?error=1');
});

app.post('/admin/logout', (req, res) => {
  req.session.isAdmin = false;
  res.redirect('/admin/login');
});

// --- ADMIN PAGES ---
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// --- ADMIN API: list orders ---
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();

    let sql = `SELECT id, full_name, email, total, shipping, status, created_at FROM orders`;
    const params = [];

    if (status) {
      sql += ` WHERE status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC LIMIT 200`;

    const [rows] = await db.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Admin orders error:', err);
    res.status(500).json([]);
  }
});


// --- ADMIN API: order detail (items) ---
app.get('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!orderId) return res.json(null);

  try {
    const [orders] = await db.execute(`SELECT * FROM orders WHERE id = ?`, [orderId]);
    if (!orders.length) return res.json(null);

    const [items] = await db.execute(`SELECT * FROM order_items WHERE order_id = ?`, [orderId]);

    res.json({ order: orders[0], items });
  } catch (err) {
    console.error('Admin order detail error:', err);
    res.status(500).json(null);
  }
});

// --- ADMIN API: update status ---
app.post('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
  const orderId = Number(req.params.id);
  const status = String(req.body.status || '').trim();

  const allowed = new Set(['pending', 'paid', 'processing', 'shipped', 'cancelled', 'abandoned', 'payment_failed']);
  if (!orderId || !allowed.has(status)) return res.status(400).json({ ok: false });

  try {
    await db.execute(`UPDATE orders SET status = ? WHERE id = ?`, [status, orderId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Admin status update error:', err);
    res.status(500).json({ ok: false });
  }
});

// --- ADMIN PRODUCTS PAGE ---
app.get('/admin/products', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin-products.html'));
});

// --- ADMIN API: get product by id ---
app.get('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.json(null);

  try {
    const [rows] = await db.execute(
      `SELECT id, name, description, price, image, image2, image3, image4, stock, active, product_type
       FROM products
       WHERE id = ?`,
      [id]
    );

    if (!rows.length) return res.json(null);

    const product = rows[0];

    if (product.product_type === 'set') {
      const [bundleItems] = await db.execute(
        `SELECT child_product_id, qty, sort_order
         FROM product_bundle_items
         WHERE bundle_product_id = ?
         ORDER BY sort_order ASC`,
        [id]
      );

      product.bundleItems = bundleItems;
    }

    res.json(product);
  } catch (err) {
    console.error('Admin product detail error:', err);
    res.status(500).json(null);
  }
});

app.get('/api/admin/products', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, name, price, image, image2, image3, image4, stock, active, created_at
       FROM products
       ORDER BY created_at DESC
       LIMIT 500`
    );
    res.json(rows);
  } catch (err) {
    console.error('Admin products list error:', err);
    res.status(500).json([]);
  }
});

app.get('/api/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.json(null);

  try {
    const [rows] = await db.execute(
      `SELECT id, name, description, price, image, image2, image3, image4, stock, product_type
       FROM products
       WHERE id = ? AND active = 1`,
      [id]
    );

    if (!rows.length) return res.json(null);

    const product = rows[0];

    if (product.product_type === 'set') {
      const [bundleItems] = await db.execute(
        `SELECT 
           p.id,
           p.name,
           p.price,
           p.image,
           p.stock,
           bi.qty,
           bi.sort_order
         FROM product_bundle_items bi
         JOIN products p ON p.id = bi.child_product_id
         WHERE bi.bundle_product_id = ?
         ORDER BY bi.sort_order ASC`,
        [id]
      );

      product.bundleItems = bundleItems;
    }

    res.json(product);
  } catch (err) {
    console.error('Product detail error:', err);
    res.status(500).json(null);
  }
});

// --- ADMIN API: create product ---
app.post('/api/admin/products', requireAdmin, async (req, res) => {
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  const price = Number(req.body.price);
  const image = String(req.body.image || '').trim();
  const image2 = String(req.body.image2 || '').trim();
  const image3 = String(req.body.image3 || '').trim();
  const image4 = String(req.body.image4 || '').trim();
  const stock = Number(req.body.stock);
  const active = req.body.active === '0' ? 0 : 1;
  const productType = String(req.body.product_type || 'single').trim();

  const bundleItems = [
    Number(req.body.bundle_item_1 || 0),
    Number(req.body.bundle_item_2 || 0),
    Number(req.body.bundle_item_3 || 0)
  ].filter(Boolean);

  if (!name) return res.status(400).json({ ok: false, error: 'Name required' });
  if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ ok: false, error: 'Invalid price' });
  if (!Number.isInteger(stock) || stock < 0) return res.status(400).json({ ok: false, error: 'Invalid stock' });
  if (!image) return res.status(400).json({ ok: false, error: 'Main image required' });

  try {
    const [r] = await db.execute(
      `INSERT INTO products (name, description, price, image, image2, image3, image4, stock, active, product_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        description || null,
        price,
        image,
        image2 || null,
        image3 || null,
        image4 || null,
        stock,
        active,
        productType
      ]
    );

    const productId = r.insertId;

    if (productType === 'set') {
      for (let i = 0; i < bundleItems.length; i++) {
        await db.execute(
          `INSERT INTO product_bundle_items (bundle_product_id, child_product_id, qty, sort_order)
           VALUES (?, ?, ?, ?)`,
          [productId, bundleItems[i], 1, i + 1]
        );
      }
    }

    res.json({ ok: true, id: productId });
  } catch (err) {
    console.error('Admin create product error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- ADMIN API: update product ---
app.post('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  const price = Number(req.body.price);
  const image = String(req.body.image || '').trim();
  const image2 = String(req.body.image2 || '').trim();
  const image3 = String(req.body.image3 || '').trim();
  const image4 = String(req.body.image4 || '').trim();
  const stock = Number(req.body.stock);
  const active = req.body.active === '0' ? 0 : 1;
  const productType = String(req.body.product_type || 'single').trim();

  const bundleItems = [
    Number(req.body.bundle_item_1 || 0),
    Number(req.body.bundle_item_2 || 0),
    Number(req.body.bundle_item_3 || 0)
  ].filter(Boolean);

  if (!id) return res.status(400).json({ ok: false });
  if (!name) return res.status(400).json({ ok: false, error: 'Name required' });
  if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ ok: false, error: 'Invalid price' });
  if (!Number.isInteger(stock) || stock < 0) return res.status(400).json({ ok: false, error: 'Invalid stock' });
  if (!image) return res.status(400).json({ ok: false, error: 'Main image required' });

  try {
    await db.execute(
      `UPDATE products
       SET name=?, description=?, price=?, image=?, image2=?, image3=?, image4=?, stock=?, active=?, product_type=?
       WHERE id=?`,
      [
        name,
        description || null,
        price,
        image,
        image2 || null,
        image3 || null,
        image4 || null,
        stock,
        active,
        productType,
        id
      ]
    );

    await db.execute(
      `DELETE FROM product_bundle_items WHERE bundle_product_id = ?`,
      [id]
    );

    if (productType === 'set') {
      for (let i = 0; i < bundleItems.length; i++) {
        await db.execute(
          `INSERT INTO product_bundle_items (bundle_product_id, child_product_id, qty, sort_order)
           VALUES (?, ?, ?, ?)`,
          [id, bundleItems[i], 1, i + 1]
        );
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Admin update product error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- ADMIN API: "delete" product (soft delete) ---
app.post('/api/admin/products/:id/delete', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ ok: false });

  try {
    await db.execute(`UPDATE products SET active=0 WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Admin delete product error:', err);
    res.status(500).json({ ok: false });
  }
});

// --- ADMIN API: upload product image ---
app.post('/api/admin/upload', requireAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ ok: false, error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file uploaded' });
    }

    const urlPath = `/uploads/${req.file.filename}`;
    return res.json({ ok: true, path: urlPath });
  });
});

// Cart actions
app.post('/cart/add', async (req, res) => {
  try {
    const cart = getCart(req);

    const id = String(req.body.id || '');
    const size = String(req.body.size || 'M');
    const qty = Math.max(1, Number(req.body.qty || 1));

    const [rows] = await db.execute(
      'SELECT id, name, price, image, active, stock FROM products WHERE id = ?',
      [id]
    );

    if (!rows.length) {
      return res.redirect('/shop?error=notfound');
    }

    const product = rows[0];

    if (Number(product.active) !== 1) {
      return res.redirect('/shop?error=inactive');
    }

    if (Number(product.stock) < qty) {
      return res.redirect(`/product?id=${id}&error=stock`);
    }

    const existing = cart.find(i => i.id === String(product.id) && i.size === size);

    if (existing) {
      const newQty = existing.qty + qty;

      if (newQty > Number(product.stock)) {
        return res.redirect(`/product?id=${id}&error=stock`);
      }

      existing.qty = newQty;
    } else {
      cart.push({
        id: String(product.id),
        name: product.name,
        price: Number(product.price),
        image: product.image || '',
        size,
        qty
      });
    }

    res.redirect('/cart');
  } catch (err) {
    console.error('Cart add error:', err);
    res.status(500).send('Cart error');
  }
});

app.post('/cart/update', async (req, res) => {
  try {
    const cart = getCart(req);

    const id = String(req.body.id || '');
    const size = String(req.body.size || '');
    const qty = Math.max(1, Number(req.body.qty || 1));

    const item = cart.find(i => i.id === id && i.size === size);
    if (!item) return res.redirect('/cart');

    const [rows] = await db.execute(
      'SELECT stock, active FROM products WHERE id = ?',
      [id]
    );

    if (!rows.length || Number(rows[0].active) !== 1) {
      req.session.cart = cart.filter(i => !(i.id === id && i.size === size));
      return res.redirect('/cart');
    }

    const stock = Number(rows[0].stock || 0);

    if (qty > stock) {
      item.qty = Math.max(1, stock);
    } else {
      item.qty = qty;
    }

    if (stock <= 0) {
      req.session.cart = cart.filter(i => !(i.id === id && i.size === size));
    }

    res.redirect('/cart');
  } catch (err) {
    console.error('Cart update error:', err);
    res.status(500).send('Cart error');
  }
});

app.post('/cart/remove', (req, res) => {
  const cart = getCart(req);

  const id = String(req.body.id || '');
  const size = String(req.body.size || '');

  req.session.cart = cart.filter(i => !(i.id === id && i.size === size));
  res.redirect('/cart');
});

// Checkout -> Create DB order (pending) -> Stripe Checkout
app.post('/checkout', async (req, res) => {
  const cart = req.session.cart || [];
  if (!cart.length) return res.redirect('/cart');

  try {
    let total = 0;
    const lineItems = [];
    const validatedItems = [];

    // 1) Validate all cart items against DB and build trusted checkout data
    for (const item of cart) {
      const quantity = Number(item.qty);

      if (!Number.isInteger(quantity) || quantity < 1) {
        console.log('Bad quantity detected:', item.qty, 'Item:', item);
        return res.status(400).send('Invalid quantity');
      }

      const [rows] = await db.execute(
  'SELECT id, name, price, image, active, stock FROM products WHERE id = ?',
  [item.id]
);

if (!rows.length) {
  return res.status(400).send('Product not found');
}

const product = rows[0];

// Check product is active
if (Number(product.active) !== 1) {
  return res.status(400).send('Product is no longer available');
}

// Validate price from DB
const unitPrice = Number(product.price);
if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
  return res.status(400).send('Invalid product price in database');
}

// Check stock availability
if (product.stock < quantity) {
  return res.status(400).send('Not enough stock available');
}

      total += unitPrice * quantity;

      validatedItems.push({
        product_id: product.id,
        name: product.name,
        price: unitPrice,
        image: product.image || '',
        size: String(item.size || 'M'),
        qty: quantity
      });

      lineItems.push({
        price_data: {
          currency: 'gbp',
          product_data: {
            name: `${product.name} (Size ${String(item.size || 'M')})`
          },
          unit_amount: Math.round(unitPrice * 100)
        },
        quantity
      });
    }

    // 2) Create order (pending)
    const [orderResult] = await db.execute(
      `INSERT INTO orders (full_name, email, phone, postcode, address1, address2, city, notes, total, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        req.body.fullName,
        req.body.email,
        req.body.phone || null,
        req.body.postcode,
        req.body.address1,
        req.body.address2 || null,
        req.body.city,
        req.body.notes || null,
        total
      ]
    );

    const orderId = orderResult.insertId;

    // 3) Insert trusted order items
    for (const item of validatedItems) {
      await db.execute(
        `INSERT INTO order_items (order_id, product_id, name, price, size, qty, image)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.name, item.price, item.size, item.qty, item.image]
      );
    }

    // 4) Create Stripe Checkout Session using trusted DB prices
    const shippingOptions = total >= 80
  ? [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: {
            amount: 0,
            currency: 'gbp'
          },
          display_name: 'Free Shipping',
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 2 },
            maximum: { unit: 'business_day', value: 5 }
          }
        }
      }
    ]
  : [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: {
            amount: 799, // £7.99 in pence
            currency: 'gbp'
          },
          display_name: 'Standard Shipping',
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 2 },
            maximum: { unit: 'business_day', value: 5 }
          }
        }
      }
    ];

const stripeSession = await stripe.checkout.sessions.create({
  mode: 'payment',
  payment_method_types: ['card'],
  line_items: lineItems,

  shipping_address_collection: {
    allowed_countries: ['GB']
  },

  shipping_options: shippingOptions,

  metadata: { orderId: String(orderId) },
  success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${process.env.BASE_URL}/cancel?orderId=${orderId}`
});

    return res.redirect(303, stripeSession.url);

  } catch (err) {
    console.error('Stripe checkout error message:', err?.message);
    console.error('Stripe checkout error raw:', err);
    res.status(500).send('Checkout error');
  }
});

// Stripe success/cancel (keep as fallback)
app.get('/success', async (req, res) => {
  const sessionId = req.query.session_id;
  if (!sessionId) return res.redirect('/');

  try {
    const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
    const orderId = Number(stripeSession.metadata?.orderId);
    if (!orderId) return res.redirect('/');

    // Just clear cart and redirect
    req.session.cart = [];

    return res.redirect(`/confirmation?orderId=${orderId}`);
  } catch (err) {
    console.error('Success route error:', err);
    res.status(500).send('Payment success handling error');
  }
});

app.get('/cancel', async (req, res) => {
  const orderId = Number(req.query.orderId);
  if (orderId) {
    await db.execute(`UPDATE orders SET status='cancelled' WHERE id=?`, [orderId]);
  }
  res.redirect('/cart');
});

// --- PRODUCTS API ---

app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, name, price, image, stock
       FROM products
       WHERE active = 1
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Products list error:', err);
    res.status(500).json([]);
  }
});

// Start server (last)
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});