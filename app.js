const state = {
  settings: {
    businessName: "thwear",
    whatsappNumber: ""
  },
  products: [],
  visible: [],
  cart: new Map(),
  filters: {
    query: "",
    category: "all",
    size: "all",
    brand: "all"
  }
};

const MAX_CART_ITEMS = 20;

const els = {
  grid: document.querySelector("#catalogGrid"),
  search: document.querySelector("#searchInput"),
  category: document.querySelector("#categoryFilter"),
  size: document.querySelector("#sizeFilter"),
  brand: document.querySelector("#brandFilter"),
  total: document.querySelector("#totalProducts"),
  visible: document.querySelector("#visibleProducts"),
  pending: document.querySelector("#pendingPrices"),
  cartButton: document.querySelector("#cartButton"),
  cartCount: document.querySelector("#cartCount"),
  drawer: document.querySelector("#cartDrawer"),
  closeCart: document.querySelector("#closeCart"),
  cartList: document.querySelector("#cartList"),
  whatsappOrder: document.querySelector("#whatsappOrder"),
  scrim: document.querySelector("#scrim")
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

init();

async function init() {
  const [catalogResponse, settingsResponse] = await Promise.all([
    fetch("./data/catalog.json"),
    fetch("./data/settings.json")
  ]);

  const data = await catalogResponse.json();
  state.settings = {
    ...state.settings,
    ...(await settingsResponse.json())
  };
  state.products = data.products.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

  hydrateFilters();
  bindEvents();
  applyFilters();
  renderCart();

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function hydrateFilters() {
  fillSelect(els.category, "Todas categorias", unique("category"));
  fillSelect(els.size, "Todos tamanhos", unique("size"));
  fillSelect(els.brand, "Todas marcas", unique("brand"));
}

function unique(field) {
  return [...new Set(state.products.map((product) => product[field]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), "pt-BR", { numeric: true }));
}

function fillSelect(select, label, options) {
  select.innerHTML = [
    `<option value="all">${label}</option>`,
    ...options.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
  ].join("");
}

function bindEvents() {
  els.search.addEventListener("input", (event) => {
    state.filters.query = event.target.value.trim().toLowerCase();
    applyFilters();
  });

  for (const [key, select] of [
    ["category", els.category],
    ["size", els.size],
    ["brand", els.brand]
  ]) {
    select.addEventListener("change", (event) => {
      state.filters[key] = event.target.value;
      applyFilters();
    });
  }

  els.cartButton.addEventListener("click", openCart);
  els.closeCart.addEventListener("click", closeCart);
  els.scrim.addEventListener("click", closeCart);
}

function applyFilters() {
  state.visible = state.products.filter((product) => {
    const queryText = [
      product.title,
      product.category,
      product.brand,
      product.size,
      product.folderPath
    ].join(" ").toLowerCase();

    return (
      (!state.filters.query || queryText.includes(state.filters.query)) &&
      (state.filters.category === "all" || product.category === state.filters.category) &&
      (state.filters.size === "all" || product.size === state.filters.size) &&
      (state.filters.brand === "all" || product.brand === state.filters.brand)
    );
  });

  renderMetrics();
  renderCatalog();
}

function renderMetrics() {
  els.total.textContent = state.products.length;
  els.visible.textContent = state.visible.length;
  els.pending.textContent = state.products.filter((product) => product.price === null).length;
}

function renderCatalog() {
  if (!state.visible.length) {
    els.grid.innerHTML = `<div class="empty">Nenhum produto encontrado.</div>`;
    return;
  }

  els.grid.innerHTML = state.visible.map(renderProduct).join("");

  els.grid.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => addToCart(button.dataset.add));
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function renderProduct(product) {
  const price = product.price === null
    ? `<strong class="pending">Consultar preco</strong>`
    : `<strong>${money.format(product.price)}</strong>`;

  const message = encodeURIComponent(
    `Oi! Tenho interesse neste item:\n\n${product.title}\nCategoria: ${product.category}\nTamanho: ${product.size}\nMarca: ${product.brand}\nLink: ${product.driveUrl}`
  );

  return `
    <article class="product">
      <div class="image-wrap">
        <img src="${product.image}" alt="${escapeHtml(product.title)}" loading="lazy" />
        <span class="badge">${escapeHtml(product.size)}</span>
      </div>
      <div class="product-body">
        <h3>${escapeHtml(product.title)}</h3>
        <div class="meta">
          <span class="chip">${escapeHtml(product.category)}</span>
          <span class="chip">${escapeHtml(product.brand)}</span>
        </div>
        <div class="price">
          ${price}
          <span class="chip">${product.confidence === "path" ? "Drive" : "IA"}</span>
        </div>
        <div class="actions">
          <a class="primary" href="${whatsappUrl(message)}" target="_blank" rel="noreferrer">
            <i data-lucide="message-circle"></i>
            WhatsApp
          </a>
          <button class="secondary" type="button" data-add="${product.id}" title="Separar item">
            <i data-lucide="plus"></i>
          </button>
        </div>
      </div>
    </article>
  `;
}

function addToCart(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;

  if (!state.cart.has(productId) && state.cart.size >= MAX_CART_ITEMS) {
    openCart();
    return;
  }

  state.cart.set(productId, product);
  renderCart();
  openCart();
}

function renderCart() {
  const items = [...state.cart.values()];
  els.cartCount.textContent = items.length;

  if (!items.length) {
    els.cartList.innerHTML = `<div class="empty">Nenhum item separado.</div>`;
  els.whatsappOrder.href = "https://wa.me/";
    return;
  }

  const limitWarning = items.length >= MAX_CART_ITEMS
    ? `<div class="cart-note">Limite de ${MAX_CART_ITEMS} itens por mensagem.</div>`
    : "";

  els.cartList.innerHTML = `${limitWarning}${items.map((item) => `
    <div class="cart-item">
      <img src="${item.image}" alt="${escapeHtml(item.title)}" />
      <div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.category)} · ${escapeHtml(item.size)} · ${escapeHtml(item.brand)}</p>
      </div>
      <button class="icon-link" type="button" data-remove="${item.id}" title="Remover">
        <i data-lucide="trash-2"></i>
      </button>
    </div>
  `).join("")}`;

  els.cartList.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      state.cart.delete(button.dataset.remove);
      renderCart();
    });
  });

  const message = encodeURIComponent([
    "Oi! Quero consultar estes itens:",
    "",
    ...items.map((item, index) => `${index + 1}. ${item.title} | ${item.category} | Tam. ${item.size} | ${item.brand}\n${item.driveUrl}`)
  ].join("\n"));

  els.whatsappOrder.href = whatsappUrl(message);

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function openCart() {
  els.drawer.classList.add("open");
  els.scrim.classList.add("open");
  els.drawer.setAttribute("aria-hidden", "false");
}

function closeCart() {
  els.drawer.classList.remove("open");
  els.scrim.classList.remove("open");
  els.drawer.setAttribute("aria-hidden", "true");
}

function whatsappUrl(encodedMessage = "") {
  const number = String(state.settings.whatsappNumber || "").replace(/\D/g, "");
  const base = number ? `https://wa.me/${number}` : "https://wa.me/";
  return encodedMessage ? `${base}?text=${encodedMessage}` : base;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
