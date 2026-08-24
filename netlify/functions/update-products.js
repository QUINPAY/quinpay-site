const { getQuinpayStore } = require("./lib/store");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { password, changes } = body;

    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Contraseña incorrecta" }),
      };
    }

    if (!changes || typeof changes !== "object") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Faltan los cambios a guardar" }),
      };
    }

    const store = getQuinpayStore();
    let overrides = {};
    try {
      const raw = await store.get("overrides", { type: "json" });
      if (raw) overrides = raw;
    } catch (e) {
      // no overrides yet
    }

    // merge incoming changes: { productId: { price, in_stock } }
    for (const [id, change] of Object.entries(changes)) {
      overrides[id] = { ...(overrides[id] || {}), ...change };
    }

    await store.setJSON("overrides", overrides);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
