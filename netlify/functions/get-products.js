const { getQuinpayStore } = require("./lib/store");
const seed = require("../../data/products-seed.json");

exports.handler = async function () {
  try {
    const store = getQuinpayStore();
    let overrides = {};
    try {
      const raw = await store.get("overrides", { type: "json" });
      if (raw) overrides = raw;
    } catch (e) {
      // no overrides saved yet, that's fine
    }

    const products = seed.map((p) => {
      const o = overrides[p.id] || {};
      return {
        ...p,
        price: typeof o.price === "number" ? o.price : p.price,
        in_stock: typeof o.in_stock === "boolean" ? o.in_stock : p.in_stock,
      };
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(products),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
