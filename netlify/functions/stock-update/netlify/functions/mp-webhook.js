const { getQuinpayStore } = require("./lib/store");

exports.handler = async function (event) {
  try {
    const params = event.queryStringParameters || {};
    let paymentId = params["data.id"] || params["id"];

    if (!paymentId && event.body) {
      try {
        const body = JSON.parse(event.body);
        paymentId = body?.data?.id || body?.id;
      } catch (e) {}
    }

    if (!paymentId) {
      // Nothing to process (could be a test ping) — acknowledge anyway
      return { statusCode: 200, body: "ok" };
    }

    // Verify the payment directly with Mercado Pago — never trust the webhook body alone
    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    if (!resp.ok) {
      return { statusCode: 200, body: "ok" }; // ack so MP doesn't retry forever on bad id
    }
    const payment = await resp.json();

    if (payment.status !== "approved" || !payment.external_reference) {
      return { statusCode: 200, body: "ok" };
    }

    const store = getQuinpayStore();
    const orderKey = `order:${payment.external_reference}`;
    let order;
    try {
      order = await store.get(orderKey, { type: "json" });
    } catch (e) {
      order = null;
    }

    if (!order || order.status === "paid") {
      // Already processed (MP can send the same notification more than once) or unknown order
      return { statusCode: 200, body: "ok" };
    }

    // Decrement stock for each line, clamped at 0
    let overrides = {};
    try {
      const raw = await store.get("overrides", { type: "json" });
      if (raw) overrides = raw;
    } catch (e) {}

    for (const line of order.lines) {
      const seed = require("../../data/products-seed.json");
      const seedProduct = seed.find((p) => p.id === line.id);
      const currentStock =
        overrides[line.id] && typeof overrides[line.id].stock === "number"
          ? overrides[line.id].stock
          : seedProduct?.stock || 0;
      const newStock = Math.max(0, currentStock - line.qty);
      overrides[line.id] = { ...(overrides[line.id] || {}), stock: newStock };
    }

    await store.setJSON("overrides", overrides);
    await store.setJSON(orderKey, { ...order, status: "paid", paidAt: new Date().toISOString() });

    return { statusCode: 200, body: "ok" };
  } catch (err) {
    // Always ack with 200 so Mercado Pago doesn't hammer us with retries; log for visibility
    console.error("mp-webhook error:", err);
    return { statusCode: 200, body: "ok" };
  }
};
