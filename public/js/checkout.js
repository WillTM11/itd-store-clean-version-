function money(n){ return `£${Number(n).toFixed(2)}`; }

async function loadCart(){
  const res = await fetch('/api/cart');
  return res.json();
}

function renderSummary(root, cart, total){
  if (!cart.length){
    root.innerHTML = `<p class="muted">Your cart is empty. <a href="/shop">Go to shop</a></p>`;
    return;
  }

  const items = cart.map(i => `
    <div class="sum-item">
      <div>
        <div class="sum-name">${i.name}</div>
        <div class="sum-meta muted">Size: ${i.size} • Qty: ${i.qty}</div>
      </div>
      <div class="sum-price">${money(i.price * i.qty)}</div>
    </div>
  `).join('');

  root.innerHTML = `
    <div class="sum-list">${items}</div>
    <div class="divider"></div>
    <div class="cart__row cart__total"><span>Total</span><span>${money(total)}</span></div>
  `;
}

(async function init(){
  const root = document.getElementById('summaryRoot');
  const { cart, total } = await loadCart();
  renderSummary(root, cart, total);
})();
