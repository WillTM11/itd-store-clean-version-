# itd-store-clean-version-
A full-stack e-commerce web application built from scratch to be potentially deployed as a real world store with functionality such as payments, order management and stoack control

# ITD Clothing Store

**Live Site:** (https://inthedistanceitd.com/)

A full-stack e-commerce web application built from scratch to handle real-world online store functionality, including payments, order management, and stock control.

---

## Tech Stack

* **Frontend:** HTML, CSS, JavaScript
* **Backend:** Node.js, Express
* **Database:** MySQL
* **Payments:** Stripe Checkout + Webhooks
* **Deployment:** Render

---

## Features

* Product browsing and shopping cart
* Secure checkout with Stripe
* Order management system
* Automatic stock updates after purchase
* Admin dashboard for managing orders
* Shipping logic (free over £80, UK only)
* Fully responsive design

---

## Key Implementation Details

### Stripe Webhooks

* Uses Stripe webhooks to confirm payments securely
* On successful checkout:

  * Order status updated to **paid**
  * Stock is reduced in the database
  * Supports bundled/set products

### Database Design

* `orders` table stores customer + order info
* `order_items` links products to orders
* Relational structure ensures accurate stock tracking

### Admin System

* View all orders
* Update order status (pending → shipped)
* Displays total including shipping

---

## Challenges & Solutions

**Issue:** Orders remained in “pending” state after payment
**Cause:** Webhook endpoint not correctly configured
**Solution:** Fixed Stripe CLI forwarding and endpoint routing, ensuring events reached the server

---

## Note

Sensitive configuration such as API keys, database credentials, and environment variables have been removed for security purposes.

---

## About This Project

This project was built to simulate a real-world e-commerce system and demonstrate full-stack development skills, including backend logic, API design, database management, and third-party integrations.

---

## Screenshots (optional)

<img width="1916" height="963" alt="image" src="https://github.com/user-attachments/assets/6fd4a496-244b-4302-9e46-5be367a119de" />

---
