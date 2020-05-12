'use strict';

const bcoin = require('bcoin').set('testnet');
const bcrypto = require('bcrypto');
const fs = require('fs');
const network = bcoin.Network.get('testnet');

const DATA_DIR_PATH = './data/';
const BTC_DATA_DIR_PATH = DATA_DIR_PATH + 'btc/';
const BTC_CONTRACTS_DIR_PATH = BTC_DATA_DIR_PATH + 'contracts/';
const BTC_TRANSACTIONS_DIR_PATH = BTC_DATA_DIR_PATH + 'transactions/';

function createDataDirsIfNeeds() {
  if (!fs.existsSync(DATA_DIR_PATH)) {
    fs.mkdirSync(DATA_DIR_PATH);
  }
  if (!fs.existsSync(BTC_DATA_DIR_PATH)) {
    fs.mkdirSync(BTC_DATA_DIR_PATH);
  }
  if (!fs.existsSync(BTC_CONTRACTS_DIR_PATH)) {
    fs.mkdirSync(BTC_CONTRACTS_DIR_PATH);
  }
  if (!fs.existsSync(BTC_TRANSACTIONS_DIR_PATH)) {
    fs.mkdirSync(BTC_TRANSACTIONS_DIR_PATH);
  }
}

function recoverMasterFromMnemonic(mnemonicStr) {
  const mnemonic = new bcoin.hd.Mnemonic(mnemonicStr);
  return bcoin.hd.fromMnemonic(mnemonic);
}

async function createWalletFromMnemonic(mnemonicStr) {
  const wdb = new bcoin.WalletDB({ db: 'memory' });
  await wdb.open();
  const masterKey = recoverMasterFromMnemonic(mnemonicStr)
  return await wdb.create({master: masterKey});
}

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

/**
 * Generate a private / public key pair
 * or pass a pre-generated private key to just get the public key
 */
function getKeyPair(privateKey) {
  privateKey = ensureBuffer(privateKey);

  const keyring = bcoin.KeyRing.fromPrivate(privateKey);
  const publicKey = keyring.publicKey;

  return {
    'publicKey': publicKey,
    'privateKey': privateKey,
    'address': keyring.getAddress()
  };
}

function getAddressFromRedeemScript(redeemScript) {
  return bcoin.Address.fromScripthash(redeemScript.hash160());
}

function verifyMTX(mtx) {
  return mtx.verify(bcoin.Script.flags.STANDARD_VERIFY_FLAGS);
}

/**
 * Utility: Search transaction for HTLC redemption and extract hashed secret
 */
function extractSecret(tx, address) {
  if (typeof address !== 'string')
    address = address.toString();

  for (const input of tx.inputs) {
    const inputJSON = input.getJSON();
    const inAddr = inputJSON.address;
    if (inAddr === address) {
      return input.script.code[1].data;
    }
  }
  return false;
}

function serializeContract(contractScript, contractAddress) {
  createDataDirsIfNeeds();
  let jsonString = contractScript.toJSON();
  let contractBufferPath = BTC_CONTRACTS_DIR_PATH + "buffer" + contractAddress;
  fs.writeFileSync(contractBufferPath, jsonString, {encoding: 'utf8'});
  return contractBufferPath;
}

function deserializeContract(contractAddress) {
  let contractBufferPath = BTC_CONTRACTS_DIR_PATH + "buffer" + contractAddress;
  let jsonString = fs.readFileSync(contractBufferPath, {encoding: 'utf8'});
  return bcoin.Script.fromJSON(jsonString);
}

async function sendTransaction(value, toAddress, changeAddress, accountName = 'default', rate = 1000) {
  const walletId="primary"
  const wallet = walletClient.wallet(walletId);

  const options = {
    rate: rate,
    changeAddress: changeAddress, //optional
    account: accountName,
    outputs: [{ value: value, address: toAddress }]
  };
  const result = await wallet.send(options);
  console.log(result);
  return result;
}

/**
 * (local testing only) Create a "coinbase" UTXO to spend from
 */
function getFundingTX(contractAddress, value) {
  const cb = new bcoin.MTX();
  cb.addInput({
    prevout: new bcoin.Outpoint(),
    script: new bcoin.Script(),
    sequence: 0xffffffff
  });
  cb.addOutput({
    address: contractAddress,
    value: value
  });

  return cb;
}

/**
 * Utility: Search transaction for address and get output index and value
 */

function extractOutput(tx, address) {
  if (typeof address !== 'string')
    address = address.toString();

  for (let i = 0; i < tx.outputs.length; i++) {
    const outputJSON = tx.outputs[i].getJSON();
    const outAddr = outputJSON.address;
    // const outAddr = tx.outputs[i].address;
    // const outValue = tx.outputs[i].value;
    // console.log(tx.outputs[i].path);
    if (outAddr === address) {
      return {
        index: i,
        amount: outputJSON.value
      };
    }
  }
  return false;
}

/**
 * Generate complete transaction to spend HTLC
 * Works for both swap and refund
 */
function createRedeemTX(sendToAddress, fee, fundingTX, fundingTXoutput, redeemScript, inputScript, locktime, privateKey) {
  // Init and check input
  const redeemTX = new bcoin.MTX();
  privateKey = ensureBuffer(privateKey);

  // Add coin (input UTXO to spend) from HTLC transaction output
  const coin = bcoin.Coin.fromTX(fundingTX, 0, -1);
  redeemTX.addCoin(coin);

  // Add output to mtx and subtract fee
  if (coin.value - fee < 0) {
    throw new Error('Fee is greater than output value');
  }

  redeemTX.addOutput({
    address: sendToAddress,
    value: coin.value - fee
  });

  // Insert input script (swap or refund) to satisfy HTLC condition
  redeemTX.inputs[0].script = inputScript;

  // Refunds also need to set relative lock time
  if (locktime) {
    redeemTX.setSequence(0, locktime, true);
  } else {
    redeemTX.inputs[0].sequence = 0xffffffff;
  }

  // Sign transaction and insert sig over placeholder
  const sig = signInput(redeemTX,0, redeemScript, coin.value, privateKey, null, 0);
  inputScript.setData(0, sig);

  // Finish and return
  inputScript.compile();
  return redeemTX;
}

function signInput(mtx, index, redeemScript, value, privateKey, sigHashType, version_or_flags) {
  privateKey = ensureBuffer(privateKey);
  return mtx.signature(index, redeemScript, value, privateKey, sigHashType, version_or_flags);
}

module.exports = {
  BTC_CONTRACTS_DIR_PATH: BTC_CONTRACTS_DIR_PATH,
  createDataDirsIfNeeds: createDataDirsIfNeeds,
  ensureBuffer: ensureBuffer,
  recoverMasterFromMnemonic: recoverMasterFromMnemonic,
  createWalletFromMnemonic: createWalletFromMnemonic,
  createSecret: createSecret,
  createRedeemScript: createRedeemScript,
  createRefundInputScript: createRefundInputScript,
  createSwapInputScript: createSwapInputScript,
  getKeyPair: getKeyPair,
  getAddressFromRedeemScript: getAddressFromRedeemScript,
  verifyMTX: verifyMTX,
  extractSecret: extractSecret,
  serializeContract: serializeContract,
  deserializeContract: deserializeContract,
  sendTransaction: sendTransaction,
  getFundingTX: getFundingTX,
  extractOutput: extractOutput,
  createRedeemTX: createRedeemTX,
  signInput: signInput,
}