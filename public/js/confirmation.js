function money(n){ return `£${Number(n).toFixed(2)}`; }

function getOrderId(){
  const p = new URLSearchParams(window.location.search);
  return p.get('orderId');
}

async function loadOrder(orderId){
  const res = await fetch(`/api/order?orderId=${orderId}`);
  return res.json();
}

(async function init(){
  const root = document.getElementById('confirmRoot');
  const orderId = getOrderId();

  if (!orderId){
    root.innerHTML = `<p class="muted">Missing order id.</p>`;
    return;
  }

  const data = await loadOrder(orderId);
  if (!data){
    root.innerHTML = `<p class="muted">Order not found.</p>`;
    return;
  }

  const { order, items } = data;

  const itemsHtml = items.map(i => `
    <div class="sum-item">
      <div>
        <div class="sum-name">${i.name}</div>
        <div class="sum-meta muted">Size: ${i.size} • Qty: ${i.qty}</div>
      </div>
      <div class="sum-price">${money(i.price * i.qty)}</div>
    </div>
  `).join('');

  root.innerHTML = `
    <p class="muted">Order ID: <strong>${order.id}</strong></p>
    <p class="muted">Email: <strong>${order.email}</strong></p>
    <div class="divider"></div>
    <div class="sum-list">${itemsHtml}</div>
    <div class="divider"></div>
    <div class="cart__row cart__total"><span>Total</span><span>${money(order.total)}</span></div>
  `;
})();

