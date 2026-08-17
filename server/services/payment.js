const midtransClient = require("midtrans-client");
const crypto = require("crypto");

function getSnap() {
  return new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY,
  });
}

const PLANS = {
  monthly: { label: "Premium Bulanan", price: Number(process.env.PRICE_MONTHLY || 25000), days: 30 },
  yearly: { label: "Premium Tahunan", price: Number(process.env.PRICE_YEARLY || 250000), days: 365 },
};

async function createTransaction({ orderId, plan, customer }) {
  const planDef = PLANS[plan];
  if (!planDef) throw new Error("Plan tidak valid");
  if (!process.env.MIDTRANS_SERVER_KEY) throw new Error("MIDTRANS_SERVER_KEY belum diset — daftar dulu di dashboard.midtrans.com");

  const snap = getSnap();
  const parameter = {
    transaction_details: { order_id: orderId, gross_amount: planDef.price },
    item_details: [{ id: plan, price: planDef.price, quantity: 1, name: planDef.label }],
    customer_details: { email: customer.email, first_name: customer.name || customer.email },
    callbacks: { finish: process.env.APP_URL ? `${process.env.APP_URL}/?payment=finish` : undefined },
  };

  const transaction = await snap.createTransaction(parameter);
  return { ...transaction, plan, amount: planDef.price, days: planDef.days };
}

function verifySignature({ order_id, status_code, gross_amount, signature_key }) {
  const expected = crypto.createHash("sha512").update(order_id + status_code + gross_amount + process.env.MIDTRANS_SERVER_KEY).digest("hex");
  return expected === signature_key;
}

module.exports = { createTransaction, verifySignature, PLANS };
