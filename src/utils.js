'use strict';

const bcoin = require('bcoin').set('testnet');
const bcrypto = require('bcrypto');
const network = bcoin.Network.get('testnet');
const Mnemonic = bcoin.hd.Mnemonic;
const HD = bcoin.hd;

function ensureBuffer(string) {
  return Buffer.isBuffer(string) ? string : Buffer.from(string, 'hex');
}

function createSecret(secret) {
  secret = !secret ? bcrypto.random.randomBytes(32) : ensureBuffer(secret);
  return {
    'secret': secret,
    'hash': bcrypto.SHA256.digest(secret)
  };
}

function encodeCSV(locktime, seconds) {
  let locktimeUint32 = locktime >>> 0;
  if(locktimeUint32 !== locktime)
    throw new Error('locktime must be a uint32.');

  if (seconds) {
    locktimeUint32 >>>= bcoin.consensus.SEQUENCE_GRANULARITY;
    locktimeUint32 &= bcoin.consensus.SEQUENCE_MASK;
    locktimeUint32 |= bcoin.consensus.SEQUENCE_TYPE_FLAG;
  } else {
    locktimeUint32 &= bcoin.consensus.SEQUENCE_MASK;
  }

  return locktimeUint32;
}

// REDEEM script: the output of the swap HTLC
function createRedeemScript(hash, refundPubkey, swapPubkey, locktime) {
  const redeem = new bcoin.Script();
  locktime = encodeCSV(locktime, true);

  hash = ensureBuffer(hash);
  refundPubkey = ensureBuffer(refundPubkey);
  swapPubkey = ensureBuffer(swapPubkey);

  redeem.pushSym('OP_IF');
  redeem.pushSym('OP_SHA256');
  redeem.pushData(hash);
  redeem.pushSym('OP_EQUALVERIFY');
  redeem.pushData(swapPubkey);
  redeem.pushSym('OP_CHECKSIG');
  redeem.pushSym('OP_ELSE');
  redeem.pushInt(locktime);
  redeem.pushSym('OP_CHECKSEQUENCEVERIFY');
  redeem.pushSym('OP_DROP');
  redeem.pushData(refundPubkey);
  redeem.pushSym('OP_CHECKSIG');
  redeem.pushSym('OP_ENDIF');
  redeem.compile();

  return redeem;
}

// REFUND script: used by original sender of funds to open time lock
function createRefundInputScript(redeemScript) {
  const inputRefund = new bcoin.Script();

  inputRefund.pushInt(0); // signature placeholder
  inputRefund.pushInt(0);
  inputRefund.pushData(redeemScript.toRaw());
  inputRefund.compile();

  return inputRefund;
}

// SWAP script: used by counterparty to open the hash lock
function createSwapInputScript(redeemScript, secret) {
  const inputSwap = new bcoin.Script();

  secret = ensureBuffer(secret);

  inputSwap.pushInt(0); // signature placeholder
  inputSwap.pushData(secret);
  inputSwap.pushInt(1);
  inputSwap.pushData(redeemScript.toRaw());
  inputSwap.compile();

  return inputSwap;
}


module.exports = {
  ensureBuffer: ensureBuffer,
  createSecret: createSecret,
  createRedeemScript: createRedeemScript,
  createRefundInputScript: createRefundInputScript,
  createSwapInputScript: createSwapInputScript,
}