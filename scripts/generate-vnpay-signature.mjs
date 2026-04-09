#!/usr/bin/env node
import { createHmac } from 'crypto';

const [orderId, externalId, status, amount, currency, secretArg] = process.argv.slice(2);

if (!orderId || !externalId || !status || !amount || !currency) {
  console.error('Usage: node scripts/generate-vnpay-signature.mjs <orderId> <externalId> <status> <amount> <currency> [secret]');
  process.exit(1);
}

const secret = secretArg || process.env.VNPAY_HASH_SECRET;

if (!secret) {
  console.error('Missing secret. Provide argument [secret] or set VNPAY_HASH_SECRET');
  process.exit(1);
}

const payload = {
  vnp_Amount: amount,
  vnp_Command: 'pay',
  vnp_ResponseCode: status,
  vnp_TmnCode: process.env.VNPAY_TMN_CODE || 'TMNCODE',
  vnp_TxnRef: externalId,
  vnp_TransactionStatus: status,
  vnp_Version: '2.1.0',
};

const sortedKeys = Object.keys(payload).sort();
const signData = sortedKeys.map((k) => `${k}=${payload[k]}`).join('&');
const signature = createHmac('sha512', secret)
  .update(Buffer.from(signData, 'utf-8'))
  .digest('hex');

console.log(JSON.stringify({
  orderId,
  externalId,
  vnp_ResponseCode: status,
  vnp_TransactionStatus: status,
  vnp_Amount: amount,
  vnp_CurrCode: currency,
  vnp_SecureHash: signature,
}, null, 2));
