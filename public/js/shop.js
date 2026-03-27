async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    const products = await res.json();

    const grid = document.getElementById('productsGrid');

    grid.innerHTML = products.map(p => {
      const out = Number(p.stock) <= 0;

      return `
        <a class="product ${out ? 'product--soldout' : ''}" href="/product?id=${p.id}">
          <img src="${p.image || '/images/placeholder.jpg'}" alt="${p.name}">
          <div class="product__meta">
            <h3 class="product__name">${p.name}</h3>
            <p class="product__price">£${Number(p.price).toFixed(2)}</p>
            ${out ? '<p class="product__stock product__stock--out">Out of stock</p>' : '<p class="product__stock">Available</p>'}
          </div>
        </a>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load products:', err);
  }
}

loadProducts();