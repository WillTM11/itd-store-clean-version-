function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

function setActiveSize(btn) {
  document.querySelectorAll('.size').forEach(b => b.classList.remove('is-active'));
  btn.classList.add('is-active');
}

function wireSizes() {
  const sizeHidden = document.getElementById('sizeHidden');
  const buttons = document.querySelectorAll('.size');

  if (!sizeHidden || !buttons.length) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const size = btn.textContent.trim();
      sizeHidden.value = size;
      setActiveSize(btn);
    });
  });

  const defaultBtn =
    Array.from(buttons).find(b => b.textContent.trim() === sizeHidden.value) ||
    buttons[2] ||
    buttons[0];

  if (defaultBtn) setActiveSize(defaultBtn);
}

function wireQty(maxStock = null) {
  const minus = document.getElementById('qtyMinus');
  const plus = document.getElementById('qtyPlus');
  const input = document.getElementById('qtyInput');
  const hidden = document.getElementById('qtyHidden');

  if (!minus || !plus || !input || !hidden) return;

  const sync = () => {
    let v = Number(input.value);
    if (!Number.isFinite(v) || v < 1) v = 1;

    if (maxStock !== null && maxStock > 0 && v > maxStock) {
      v = maxStock;
    }

    input.value = String(v);
    hidden.value = String(v);
  };

  minus.addEventListener('click', () => {
    input.value = String(Math.max(1, Number(input.value || 1) - 1));
    sync();
  });

  plus.addEventListener('click', () => {
    input.value = String(Number(input.value || 1) + 1);
    sync();
  });

  input.addEventListener('input', sync);
  sync();
}

function renderThumbs(images) {
  const thumbsWrap = document.getElementById('pThumbs');
  const mainImg = document.getElementById('pImg');

  if (!thumbsWrap || !mainImg) return;

  thumbsWrap.innerHTML = images.map((src, index) => `
    <button class="thumb ${index === 0 ? 'is-active' : ''}" type="button" data-src="${src}">
      <img src="${src}" alt="Thumbnail ${index + 1}">
    </button>
  `).join('');

  thumbsWrap.querySelectorAll('.thumb').forEach(btn => {
    btn.addEventListener('click', () => {
      mainImg.src = btn.dataset.src;
      thumbsWrap.querySelectorAll('.thumb').forEach(t => t.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
  });
}

function makeCartForm({ id, name, price, image, size = 'M', qty = 1, buttonText = 'Add to Bag' }) {
  return `
    <form class="add-form" action="/cart/add" method="POST" style="margin-top:12px;">
      <input type="hidden" name="id" value="${id}">
      <input type="hidden" name="name" value="${String(name).replace(/"/g, '&quot;')}">
      <input type="hidden" name="price" value="${price}">
      <input type="hidden" name="image" value="${image || ''}">
      <input type="hidden" name="size" value="${size}">
      <input type="hidden" name="qty" value="${qty}">
      <button class="btn btn--primary btn--full" type="submit">${buttonText}</button>
    </form>
  `;
}

function renderSetOptions(setProduct) {
  const setOptions = document.getElementById('setOptions');
  const singleProductUI = document.getElementById('singleProductUI');

  if (!setOptions) return;

  if (singleProductUI) singleProductUI.style.display = 'none';
  setOptions.style.display = 'block';

  const bundleItems = Array.isArray(setProduct.bundleItems) ? setProduct.bundleItems : [];

  const fullSetCard = `
    <div class="option" style="margin-bottom:18px;">
      <h3 class="option__title">Buy Full Set</h3>
      <p class="muted" style="margin:6px 0 10px;">
        ${bundleItems.map(i => i.name).join(' + ')}
      </p>
      ${makeCartForm({
        id: setProduct.id,
        name: setProduct.name,
        price: setProduct.price,
        image: setProduct.image || '',
        size: 'Set',
        qty: 1,
        buttonText: `Buy Full Set — £${Number(setProduct.price).toFixed(2)}`
      })}
    </div>
  `;

  const individualCards = bundleItems.map(item => {
    const out = Number(item.stock || 0) <= 0;

    return `
      <div class="option" style="padding:14px 0;border-top:1px solid #eee;">
        <div style="display:flex;gap:12px;align-items:center;">
          <img src="${item.image || '/images/placeholder.jpg'}" alt="${item.name}" style="width:72px;height:72px;object-fit:cover;border-radius:10px;border:1px solid #eee;">
          <div>
            <h4 style="margin:0 0 4px;">${item.name}</h4>
            <p class="muted" style="margin:0 0 6px;">£${Number(item.price).toFixed(2)}</p>
            <p class="muted" style="margin:0;">${out ? 'Out of stock' : 'Available individually'}</p>
          </div>
        </div>
        ${out ? `
          <button class="btn btn--primary btn--full" type="button" disabled style="margin-top:12px;opacity:0.6;">
            Out of Stock
          </button>
        ` : makeCartForm({
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image || '',
          size: 'M',
          qty: 1,
          buttonText: `Buy ${item.name} Only — £${Number(item.price).toFixed(2)}`
        })}
      </div>
    `;
  }).join('');

  setOptions.innerHTML = `
    <div class="divider"></div>
    <h3 class="option__title">Purchase Options</h3>
    ${fullSetCard}
    <div class="option">
      <h3 class="option__title">Buy Individual Pieces</h3>
      ${individualCards || '<p class="muted">No individual items available.</p>'}
    </div>
  `;
}

async function loadProduct() {
  const id = qs('id');
  if (!id) {
    console.warn('No product ID in URL');
    return;
  }

  try {
    const res = await fetch(`/api/products/${id}`);
    const p = await res.json();

    if (!p) {
      console.warn('Product not found');
      return;
    }

    const images = [
      p.image,
      p.image2,
      p.image3,
      p.image4
    ].filter(Boolean);

    const mainImage = images[0] || '/images/placeholder.jpg';
    const stock = Number(p.stock || 0);
    const isSet = p.product_type === 'set';

    document.getElementById('pName').textContent = p.name;
    document.getElementById('pPrice').textContent = `£${Number(p.price).toFixed(2)}`;
    document.getElementById('pDesc').textContent = p.description || '';
    document.getElementById('pImg').src = mainImage;

    renderThumbs(images.length ? images : ['/images/placeholder.jpg']);

    const stockEl = document.getElementById('pStock');
    const addBtn = document.getElementById('addToBagBtn');
    const qtyInput = document.getElementById('qtyInput');
    const qtyHidden = document.getElementById('qtyHidden');
    const singleProductUI = document.getElementById('singleProductUI');
    const setOptions = document.getElementById('setOptions');

    if (isSet) {
      stockEl.textContent = 'Set available';
      stockEl.style.color = '';
      if (singleProductUI) singleProductUI.style.display = 'none';
      if (setOptions) renderSetOptions(p);
    } else {
      if (setOptions) {
        setOptions.style.display = 'none';
        setOptions.innerHTML = '';
      }
      if (singleProductUI) singleProductUI.style.display = 'block';

      if (stock <= 0) {
        stockEl.textContent = 'Out of stock';
        stockEl.style.color = '#b00020';

        if (addBtn) {
          addBtn.disabled = true;
          addBtn.textContent = 'Out of Stock';
        }

        if (qtyInput) qtyInput.disabled = true;
        if (qtyHidden) qtyHidden.value = '1';
      } else {
        stockEl.textContent = 'Available';
        stockEl.style.color = '';

        if (addBtn) {
          addBtn.disabled = false;
          addBtn.textContent = 'Add to Bag';
        }

        if (qtyInput) qtyInput.disabled = false;
      }

      document.getElementById('pid').value = p.id;
      document.getElementById('pname').value = p.name;
      document.getElementById('pprice').value = p.price;
      document.getElementById('pimage').value = mainImage;

      wireQty(stock);
    }
  } catch (err) {
    console.error('Failed to load product:', err);
  }
}

loadProduct();
wireSizes();