exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }
  try {
    const { password } = JSON.parse(event.body || "{}");
    const ok = !!password && password === process.env.ADMIN_PASSWORD;
    return {
      statusCode: ok ? 200 : 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
