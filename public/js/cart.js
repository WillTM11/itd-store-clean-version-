async function loadCart() {
  const res = await fetch('/api/cart');
  const data = await res.json();
  return data;
}

function money(n) {
  return `£${Number(n).toFixed(2)}`;
}

function renderCart(root, cart, total) {
  if (!cart.length) {
    root.innerHTML = `
      <p class="muted">Your bag is empty.</p>
      <p style="margin-top:10px;"><a class="btn btn--primary" href="/shop">Go to Shop</a></p>
    `;
    return;
  }

  const itemsHtml = cart.map(item => `
    <div class="cart-item">
      <img class="cart-item__img" src="${item.image}" alt="${item.name}">
      <div class="cart-item__info">
        <div class="cart-item__top">
          <div>
            <div class="cart-item__name">${item.name}</div>
            <div class="cart-item__meta">Size: ${item.size}</div>
          </div>
          <div class="cart-item__price">${money(item.price)}</div>
        </div>

        <div class="cart-item__actions">
          <form action="/cart/update" method="POST" class="cart-form">
            <input type="hidden" name="id" value="${item.id}">
            <input type="hidden" name="size" value="${item.size}">
            <label class="muted" style="font-size:13px;">Qty</label>
            <input class="cart-qty" type="number" name="qty" value="${item.qty}" min="1">
            <button class="pill" type="submit">Update</button>
          </form>

          <form action="/cart/remove" method="POST">
            <input type="hidden" name="id" value="${item.id}">
            <input type="hidden" name="size" value="${item.size}">
            <button class="pill" type="submit">Remove</button>
          </form>
        </div>
      </div>
    </div>
  `).join('');

  root.innerHTML = `
    <div class="cart__grid">
      <div class="cart__items">${itemsHtml}</div>
      <div class="cart__summary">
        <h3>Summary</h3>
        <div class="cart__row"><span>Subtotal</span><span>${money(total)}</span></div>
        <div class="cart__row"><span>Delivery</span><span class="muted">Calculated at checkout</span></div>
        <div class="divider"></div>
        <div class="cart__row cart__total"><span>Total</span><span>${money(total)}</span></div>

        <a class="btn btn--primary btn--full" href="/checkout">
  Go to Checkout
</a>

        <p class="muted small" style="margin-top:10px;">
          Checkout comes next after cart works.
        </p>
      </div>
    </div>
  `;
}

(async function init() {
  const root = document.getElementById('cartRoot');
  const { cart, total } = await loadCart();
  renderCart(root, cart, total);
})();
