function money(n){ return `£${Number(n).toFixed(2)}`; }

const tbody = document.querySelector('#productsTable tbody');
const refreshBtn = document.getElementById('refreshBtn');
const filterActive = document.getElementById('filterActive');

const form = document.getElementById('productForm');
const msg = document.getElementById('msg');

const prodId = document.getElementById('prodId');
const nameEl = document.getElementById('name');
const descEl = document.getElementById('description');
const priceEl = document.getElementById('price');
const stockEl = document.getElementById('stock');

const productTypeEl = document.getElementById('productType');
const bundleFields = document.getElementById('bundleFields');
const bundleItem1El = document.getElementById('bundleItem1');
const bundleItem2El = document.getElementById('bundleItem2');
const bundleItem3El = document.getElementById('bundleItem3');

const imageEl = document.getElementById('image');
const image2El = document.getElementById('image2');
const image3El = document.getElementById('image3');
const image4El = document.getElementById('image4');
const uploadTarget = document.getElementById('uploadTarget');

const activeEl = document.getElementById('active');

const imgPreview = document.getElementById('imgPreview');
const imgPreview2 = document.getElementById('imgPreview2');
const imgPreview3 = document.getElementById('imgPreview3');
const imgPreview4 = document.getElementById('imgPreview4');

const newBtn = document.getElementById('newBtn');
const deleteBtn = document.getElementById('deleteBtn');

const imageFile = document.getElementById('imageFile');
const uploadBtn = document.getElementById('uploadBtn');

let allProductsCache = [];

function setMessage(t) {
  msg.textContent = t || '';
}

function updatePreview() {
  if (imgPreview)  imgPreview.src  = imageEl.value.trim()  || '/images/placeholder.jpg';
  if (imgPreview2) imgPreview2.src = image2El.value.trim() || '/images/placeholder.jpg';
  if (imgPreview3) imgPreview3.src = image3El.value.trim() || '/images/placeholder.jpg';
  if (imgPreview4) imgPreview4.src = image4El.value.trim() || '/images/placeholder.jpg';
}

function toggleBundleFields() {
  if (!bundleFields || !productTypeEl) return;
  bundleFields.style.display = productTypeEl.value === 'set' ? 'block' : 'none';
}

function fillBundleSelect(selectEl, selectedValue = '') {
  if (!selectEl) return;

  const currentId = Number(prodId.value || 0);

  const options = allProductsCache
    .filter(p => Number(p.id) !== currentId)
    .map(p => `<option value="${p.id}">${p.name} (#${p.id})</option>`)
    .join('');

  selectEl.innerHTML = `
    <option value="">Select product</option>
    ${options}
  `;

  selectEl.value = selectedValue ? String(selectedValue) : '';
}

function populateBundleSelectors(selectedItems = []) {
  const ids = selectedItems.map(i => String(i.child_product_id || i.product_id || ''));

  fillBundleSelect(bundleItem1El, ids[0] || '');
  fillBundleSelect(bundleItem2El, ids[1] || '');
  fillBundleSelect(bundleItem3El, ids[2] || '');
}

function clearForm() {
  prodId.value = '';
  nameEl.value = '';
  descEl.value = '';
  priceEl.value = '';
  stockEl.value = '0';

  if (productTypeEl) productTypeEl.value = 'single';
  if (bundleItem1El) bundleItem1El.value = '';
  if (bundleItem2El) bundleItem2El.value = '';
  if (bundleItem3El) bundleItem3El.value = '';

  imageEl.value = '';
  image2El.value = '';
  image3El.value = '';
  image4El.value = '';

  activeEl.value = '1';
  if (uploadTarget) uploadTarget.value = 'image';

  populateBundleSelectors([]);
  toggleBundleFields();
  updatePreview();
  setMessage('New product');
}

if (imageEl) imageEl.addEventListener('input', updatePreview);
if (image2El) image2El.addEventListener('input', updatePreview);
if (image3El) image3El.addEventListener('input', updatePreview);
if (image4El) image4El.addEventListener('input', updatePreview);
if (productTypeEl) productTypeEl.addEventListener('change', toggleBundleFields);

async function fetchProducts() {
  const res = await fetch('/api/admin/products');
  return res.json();
}

async function fetchProduct(id) {
  const res = await fetch(`/api/admin/products/${id}`);
  return res.json();
}

async function createProduct(payload) {
  const res = await fetch('/api/admin/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(payload)
  });
  return res.json();
}

async function updateProduct(id, payload) {
  const res = await fetch(`/api/admin/products/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(payload)
  });
  return res.json();
}

async function deleteProduct(id) {
  const res = await fetch(`/api/admin/products/${id}/delete`, {
    method: 'POST'
  });
  return res.json();
}

async function uploadImage(file) {
  const fd = new FormData();
  fd.append('image', file);

  const res = await fetch('/api/admin/upload', {
    method: 'POST',
    body: fd
  });

  return res.json();
}

if (uploadBtn && imageFile) {
  uploadBtn.addEventListener('click', async () => {
    if (!imageFile.files || !imageFile.files[0]) {
      return setMessage('Choose an image first');
    }

    setMessage('Uploading...');
    try {
      const r = await uploadImage(imageFile.files[0]);

      if (r.ok) {
        const target = uploadTarget ? uploadTarget.value : 'image';

        if (target === 'image') imageEl.value = r.path;
        if (target === 'image2') image2El.value = r.path;
        if (target === 'image3') image3El.value = r.path;
        if (target === 'image4') image4El.value = r.path;

        updatePreview();
        setMessage('Uploaded ✔');
      } else {
        setMessage(r.error || 'Upload failed');
      }
    } catch (err) {
      console.error(err);
      setMessage('Upload error (check server logs)');
    }
  });

  imageFile.addEventListener('change', () => {
    const f = imageFile.files?.[0];
    if (!f) return;

    const tempUrl = URL.createObjectURL(f);
    const target = uploadTarget ? uploadTarget.value : 'image';

    if (target === 'image' && imgPreview) imgPreview.src = tempUrl;
    if (target === 'image2' && imgPreview2) imgPreview2.src = tempUrl;
    if (target === 'image3' && imgPreview3) imgPreview3.src = tempUrl;
    if (target === 'image4' && imgPreview4) imgPreview4.src = tempUrl;
  });
}

function renderRows(rows) {
  const mode = filterActive.value;

  const filtered = rows.filter(p => {
    if (mode === 'active') return Number(p.active) === 1;
    if (mode === 'inactive') return Number(p.active) === 0;
    return true;
  });

  tbody.innerHTML = filtered.map(p => `
    <tr data-id="${p.id}">
      <td>#${p.id}</td>
      <td>${p.name}</td>
      <td>${money(p.price)}</td>
      <td>${Number(p.stock ?? 0)}</td>
      <td><span class="pill">${Number(p.active) ? 'active' : 'inactive'}</span></td>
    </tr>
  `).join('');
}

async function load() {
  setMessage('');
  const rows = await fetchProducts();
  allProductsCache = rows;
  renderRows(rows);
  populateBundleSelectors([]);
}

tbody.addEventListener('click', async (e) => {
  const tr = e.target.closest('tr');
  if (!tr) return;

  const id = tr.getAttribute('data-id');
  const p = await fetchProduct(id);
  if (!p) return;

  prodId.value = p.id;
  nameEl.value = p.name || '';
  descEl.value = p.description || '';
  priceEl.value = p.price ?? '';
  stockEl.value = p.stock ?? 0;

  imageEl.value = p.image || '';
  image2El.value = p.image2 || '';
  image3El.value = p.image3 || '';
  image4El.value = p.image4 || '';

  activeEl.value = String(Number(p.active) ? 1 : 0);
  if (productTypeEl) productTypeEl.value = p.product_type || 'single';

  populateBundleSelectors(p.bundleItems || []);
  toggleBundleFields();
  updatePreview();
  setMessage(`Editing product #${p.id}`);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    name: nameEl.value.trim(),
    description: descEl.value.trim(),
    price: priceEl.value,
    stock: stockEl.value,
    image: imageEl.value.trim(),
    image2: image2El.value.trim(),
    image3: image3El.value.trim(),
    image4: image4El.value.trim(),
    active: activeEl.value,
    product_type: productTypeEl ? productTypeEl.value : 'single',
    bundle_item_1: bundleItem1El ? bundleItem1El.value : '',
    bundle_item_2: bundleItem2El ? bundleItem2El.value : '',
    bundle_item_3: bundleItem3El ? bundleItem3El.value : ''
  };

  if (!payload.name) return setMessage('Name is required');
  if (!payload.price || Number(payload.price) <= 0) return setMessage('Price must be > 0');
  if (!Number.isInteger(Number(payload.stock)) || Number(payload.stock) < 0) {
    return setMessage('Stock must be 0 or more');
  }
  if (!payload.image) {
    return setMessage('Main image is required');
  }

  if (payload.product_type === 'set') {
    const bundleIds = [
      payload.bundle_item_1,
      payload.bundle_item_2,
      payload.bundle_item_3
    ].filter(Boolean);

    if (!bundleIds.length) {
      return setMessage('Select at least one bundle item for a set');
    }

    const uniqueIds = new Set(bundleIds);
    if (uniqueIds.size !== bundleIds.length) {
      return setMessage('Bundle items must be different products');
    }
  }

  if (!prodId.value) {
    const r = await createProduct(payload);
    if (r.ok) {
      setMessage(`Created product #${r.id}`);
      await load();
      prodId.value = r.id;
    } else {
      setMessage(r.error || 'Create failed');
    }
  } else {
    const r = await updateProduct(prodId.value, payload);
    if (r.ok) {
      setMessage(`Saved product #${prodId.value}`);
      await load();
    } else {
      setMessage(r.error || 'Save failed');
    }
  }
});

newBtn.addEventListener('click', clearForm);

deleteBtn.addEventListener('click', async () => {
  if (!prodId.value) return setMessage('Select a product first');

  const ok = confirm('Deactivate this product? (It will disappear from the shop)');
  if (!ok) return;

  const r = await deleteProduct(prodId.value);
  if (r.ok) {
    setMessage(`Deactivated product #${prodId.value}`);
    await load();
    clearForm();
  } else {
    setMessage('Deactivate failed');
  }
});

refreshBtn.addEventListener('click', load);
filterActive.addEventListener('change', load);

clearForm();
load();