const { getStore } = require("@netlify/blobs");
const seed = require("../../data/products-seed.json");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { cart, mode, siteUrl } = body; // cart: [{id, qty}], mode: "retiro" | "envio"

    if (!Array.isArray(cart) || cart.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Carrito vacío" }) };
    }

    // Load current authoritative prices/stock (seed + admin overrides)
    const store = getStore("quinpay");
    let overrides = {};
    try {
      const raw = await store.get("overrides", { type: "json" });
      if (raw) overrides = raw;
    } catch (e) {}

    const catalog = {};
    seed.forEach((p) => {
      const o = overrides[p.id] || {};
      catalog[p.id] = {
        ...p,
        price: typeof o.price === "number" ? o.price : p.price,
        in_stock: typeof o.in_stock === "boolean" ? o.in_stock : p.in_stock,
      };
    });

    const items = [];

    for (const line of cart) {
      const product = catalog[line.id];
      if (!product) continue;
      if (!product.in_stock) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `${product.name} ya no tiene stock` }),
        };
      }
      const qty = Math.max(1, Math.min(10, parseInt(line.qty) || 1));
      items.push({
        title: `${product.name} (${product.brand})`,
        quantity: qty,
        currency_id: "ARS",
        unit_price: product.price,
      });
    }

    if (items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "No hay productos válidos" }) };
    }

    if (mode === "envio") {
      items.push({
        title: "Envío a zona oeste",
        quantity: 1,
        currency_id: "ARS",
        unit_price: 5000,
      });
    }

    const base = siteUrl || `https://${event.headers.host}`;

    const preference = {
      items,
      back_urls: {
        success: `${base}/gracias.html`,
        pending: `${base}/gracias.html`,
        failure: `${base}/index.html`,
      },
      auto_return: "approved",
      statement_descriptor: "QUINPAY",
    };

    const resp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preference),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: data.message || "Error creando el pago en Mercado Pago" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ init_point: data.init_point }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
