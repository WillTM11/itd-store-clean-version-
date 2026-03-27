function money(n){ return `£${Number(n).toFixed(2)}`; }
function fmtDate(s){ try { return new Date(s).toLocaleString(); } catch { return s; } }

const tbody = document.querySelector('#ordersTable tbody');
const statusFilter = document.getElementById('statusFilter');
const refreshBtn = document.getElementById('refreshBtn');
const detail = document.getElementById('detail');

async function fetchOrders() {
  const qs = new URLSearchParams();
  if (statusFilter.value) qs.set('status', statusFilter.value);

  const res = await fetch(`/api/admin/orders?${qs.toString()}`);
  return res.json();
}

async function fetchOrder(id) {
  const res = await fetch(`/api/admin/orders/${id}`);
  return res.json();
}

async function updateStatus(id, status) {
  const res = await fetch(`/api/admin/orders/${id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ status })
  });
  return res.json();
}

function renderOrders(rows) {
  tbody.innerHTML = rows.map(o => `
    <tr data-id="${o.id}">
      <td>#${o.id}</td>
      <td>${fmtDate(o.created_at)}</td>
      <td>${o.full_name}</td>
      <td>${o.email}</td>
      <td>${money(Number(o.total || 0) + Number(o.shipping || 0))}</td>
      <td><span class="pill">${o.status}</span></td>
    </tr>
  `).join('');
}

function renderDetail(data) {
  if (!data) {
    detail.style.display = 'none';
    detail.innerHTML = '';
    return;
  }

  const { order, items } = data;

  detail.style.display = 'block';
  detail.innerHTML = `
    <div class="row">
      <div>
        <h2 style="margin:0;">Order #${order.id}</h2>
        <div class="muted">${fmtDate(order.created_at)}</div>
      </div>
      <div>
        <label>Status:</label>
        <select id="statusSelect">
          ${['pending','paid','processing','shipped','cancelled','abandoned','payment_failed']
            .map(s => `<option value="${s}" ${s===order.status?'selected':''}>${s}</option>`).join('')}
        </select>
        <button class="btn" id="saveStatusBtn" type="button">Save</button>
      </div>
    </div>

    <div class="muted" style="margin-top:10px;">
  <div><strong>Name:</strong> ${order.full_name}</div>
  <div><strong>Email:</strong> ${order.email}</div>
  <div><strong>Address:</strong> ${order.address1} ${order.address2 || ''}, ${order.city}, ${order.postcode}</div>
  <div><strong>Subtotal:</strong> ${money(order.total)}</div>
  <div><strong>Shipping:</strong> ${money(order.shipping || 0)}</div>
  <div><strong>Total:</strong> ${money(Number(order.total || 0) + Number(order.shipping || 0))}</div>
  ${order.notes ? `<div><strong>Notes:</strong> ${order.notes}</div>` : ''}
</div>

    <h3 style="margin-top:14px;">Items</h3>
    ${items.map(i => `
      <div class="row" style="padding:10px 0;border-top:1px solid #eee;">
        <div>
          <div><strong>${i.name}</strong></div>
          <div class="muted">Size: ${i.size} • Qty: ${i.qty}</div>
        </div>
        <div>${money(i.price * i.qty)}</div>
      </div>
    `).join('')}
  `;

  document.getElementById('saveStatusBtn').onclick = async () => {
    const newStatus = document.getElementById('statusSelect').value;
    const r = await updateStatus(order.id, newStatus);
    if (r.ok) {
      await load();
      const updated = await fetchOrder(order.id);
      renderDetail(updated);
    } else {
      alert('Failed to update status');
    }
  };
}

async function load() {
  const rows = await fetchOrders();
  renderOrders(rows);
  renderDetail(null);
}

tbody.addEventListener('click', async (e) => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const id = tr.getAttribute('data-id');
  const data = await fetchOrder(id);
  renderDetail(data);
});

refreshBtn.addEventListener('click', load);
statusFilter.addEventListener('change', load);

load();