const PRODUCTS = [
  {
    id: 1,
    name: 'Linen Blend Duvet Cover Set',
    category: 'Bedding',
    emoji: '🛏️',
    price: 159,
    originalPrice: 199,
    badge: 'Sale',
  },
  {
    id: 2,
    name: 'Hand-Thrown Ceramic Vase',
    category: 'Decor',
    emoji: '🏺',
    price: 68,
    originalPrice: null,
    badge: null,
  },
  {
    id: 3,
    name: 'Walnut Side Table',
    category: 'Furniture',
    emoji: '🪵',
    price: 289,
    originalPrice: null,
    badge: 'New',
  },
  {
    id: 4,
    name: 'Brass Pendant Light',
    category: 'Lighting',
    emoji: '💡',
    price: 145,
    originalPrice: null,
    badge: null,
  },
  {
    id: 5,
    name: 'Organic Cotton Throw',
    category: 'Bedding',
    emoji: '🧣',
    price: 79,
    originalPrice: 99,
    badge: 'Sale',
  },
  {
    id: 6,
    name: 'Stoneware Dinner Set (16pc)',
    category: 'Kitchen & Dining',
    emoji: '🍽️',
    price: 124,
    originalPrice: null,
    badge: null,
  },
  {
    id: 7,
    name: 'Teak Outdoor Lounge Chair',
    category: 'Outdoor',
    emoji: '🪑',
    price: 449,
    originalPrice: null,
    badge: 'New',
  },
  {
    id: 8,
    name: 'Marble Coaster Set',
    category: 'Kitchen & Dining',
    emoji: '☕',
    price: 34,
    originalPrice: null,
    badge: null,
  },
];

const CATEGORIES = [
  { name: 'Furniture', emoji: '🛋️', count: 48 },
  { name: 'Bedding', emoji: '🛏️', count: 62 },
  { name: 'Lighting', emoji: '💡', count: 35 },
  { name: 'Kitchen', emoji: '🍳', count: 89 },
  { name: 'Decor', emoji: '🖼️', count: 120 },
  { name: 'Outdoor', emoji: '🌿', count: 27 },
];

let cartCount = 0;

function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  grid.innerHTML = PRODUCTS.map(
    (p) => `
    <article class="product-card" data-product-id="${p.id}">
      <div class="product-image">
        ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
        <span aria-hidden="true">${p.emoji}</span>
      </div>
      <div class="product-info">
        <p class="product-category">${p.category}</p>
        <h3>${p.name}</h3>
        <div class="product-price">
          <span class="price-current">$${p.price}</span>
          ${p.originalPrice ? `<span class="price-original">$${p.originalPrice}</span>` : ''}
        </div>
        <button class="add-to-cart" data-product="${p.name}">Add to Cart</button>
      </div>
    </article>
  `
  ).join('');

  grid.querySelectorAll('.add-to-cart').forEach((btn) => {
    btn.addEventListener('click', () => {
      cartCount++;
      document.querySelector('.cart-count').textContent = cartCount;
      btn.textContent = 'Added ✓';
      setTimeout(() => {
        btn.textContent = 'Add to Cart';
      }, 1500);
    });
  });
}

function renderCategories() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;

  grid.innerHTML = CATEGORIES.map(
    (c) => `
    <div class="category-card">
      <div class="category-icon">${c.emoji}</div>
      <h3>${c.name}</h3>
      <span>${c.count} items</span>
    </div>
  `
  ).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  renderProducts();
  renderCategories();
});
