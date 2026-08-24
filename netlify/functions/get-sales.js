const { getQuinpayStore } = require("./lib/store");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { password } = JSON.parse(event.body || "{}");
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return { statusCode: 401, body: JSON.stringify({ error: "Contraseña incorrecta" }) };
    }

    const store = getQuinpayStore();
    const { blobs } = await store.list({ prefix: "order:" });

    let totalRevenue = 0;
    let totalOrders = 0;
    const perProduct = {}; // id -> { name, qty, revenue }
    const recentOrders = [];

    for (const blob of blobs) {
      let order;
      try {
        order = await store.get(blob.key, { type: "json" });
      } catch (e) {
        continue;
      }
      if (!order || order.status !== "paid") continue;

      totalOrders += 1;
      totalRevenue += order.total || 0;

      for (const line of order.lines || []) {
        if (!perProduct[line.id]) {
          perProduct[line.id] = { name: line.name || line.id, qty: 0, revenue: 0 };
        }
        perProduct[line.id].qty += line.qty;
        perProduct[line.id].revenue += (line.unitPrice || 0) * line.qty;
      }

      recentOrders.push({
        id: blob.key.replace("order:", ""),
        total: order.total || 0,
        mode: order.mode || "retiro",
        paidAt: order.paidAt || order.createdAt,
        items: (order.lines || []).map((l) => `${l.name || l.id} x${l.qty}`).join(", "),
      });
    }

    recentOrders.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

    const topProducts = Object.entries(perProduct)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.qty - a.qty);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        totalOrders,
        totalRevenue,
        topProducts,
        recentOrders: recentOrders.slice(0, 25),
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
