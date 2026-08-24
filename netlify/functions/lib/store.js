const { getStore } = require("@netlify/blobs");

function getQuinpayStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;

  if (siteID && token) {
    return getStore({ name: "quinpay", siteID, token });
  }
  // fallback to automatic detection (works in some environments)
  return getStore("quinpay");
}

module.exports = { getQuinpayStore };
