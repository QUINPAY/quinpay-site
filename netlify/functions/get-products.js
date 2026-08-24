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
      const stock = typeof o.stock === "number" ? o.stock : p.stock;
      return {
        ...p,
        price: typeof o.price === "number" ? o.price : p.price,
        stock: stock,
        in_stock: stock > 0,
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
