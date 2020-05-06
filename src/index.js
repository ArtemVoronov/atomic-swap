'use strict';

const bcoin = require('bcoin').set('testnet');
const bcrypto = require('bcrypto');
const apiKey = process.env.BCOIN_API_KEY;
const network = bcoin.Network.get('testnet');
const Mnemonic = bcoin.hd.Mnemonic;
const HD = bcoin.hd;

const clientOptions = {
  network: network.type,
  port: network.rpcPort,
  apiKey: apiKey
}
const walletOptions = {
  network: network.type,
  port: network.walletPort,
  apiKey: apiKey
}

const nodeClient = new bcoin.NodeClient(clientOptions);
const walletClient = new bcoin.WalletClient(walletOptions);

function ensureBuffer(string) {
  if (Buffer.isBuffer(string))
    return string;
  else
    return Buffer.from(string, 'hex');
}

function createSecret(secret) {
  if (!secret)
    secret = bcrypto.random.randomBytes(32);
  else
    secret = ensureBuffer(secret);

  const hash = bcrypto.SHA256.digest(secret);

  return {
    'secret': secret,
    'hash': hash
  };
}

function encodeCSV(locktime, seconds) {
  let locktimeUint32 = locktime >>> 0;
  if(locktimeUint32 !== locktime)
    throw new Error('Locktime must be a uint32.');

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

function getAddressFromRedeemScript(redeemScript) {
  return bcoin.Address.fromScripthash(redeemScript.hash160());
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

async function createWalletFromMnemonic(mnemonicStr) {
  const wdb = new bcoin.WalletDB({ db: 'memory' });
  await wdb.open();
  const masterKey = recoverMasterFromMnemonic(mnemonicStr)
  return await wdb.create({master: masterKey});
}

function recoverMasterFromMnemonic(mnemonicStr) {
  const mnemonic = new Mnemonic(mnemonicStr);
  return HD.fromMnemonic(mnemonic);
}

function recoverKeyFromMnemonicWithDerivePath(mnemonicStr, path) {
  const recoveredMasterKey = recoverMasterFromMnemonic(mnemonicStr);
  return recoveredMasterKey.derivePath(path);
}

async function printAccountInfo(accountName) {
  const walletId="primary"
  const wallet = walletClient.wallet(walletId);

  const account = await wallet.getAccount(accountName);
  // console.log(account);
  console.log("------- " + accountName + " -------" +
      "\nreceive address:", account.receiveAddress,
      "\nchange address:", account.changeAddress,
      "\nbalance:", account.balance,
  );
}

async function sendTransaction(value, toAddress, accountName = 'default', rate = 1000) {
  const options = {
    rate: rate,
    account: accountName,
    outputs: [{ value: value, address: toAddress }]
  };
  const result = await wallet.send(options);
  console.log(result);
  return result;
}

/**
 * Generate complete transaction to spend HTLC
 * Works for both swap and refund
 */

function createRedeemTX(address, fee, fundingTX, fundingTXoutput, redeemScript, inputScript, locktime, privateKey) {
  // Init and check input
  const redeemTX = new bcoin.MTX();
  privateKey = ensureBuffer(privateKey);

  // Add coin (input UTXO to spend) from HTLC transaction output
  const coin = bcoin.Coin.fromTX(fundingTX, fundingTXoutput, -1);
  redeemTX.addCoin(coin);

  // Add output to mtx and subtract fee
  if (coin.value - fee < 0) {
    throw new Error('Fee is greater than output value');
  }

  redeemTX.addOutput({
    address: address,
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

/**
 * (local testing only) Create a "coinbase" UTXO to spend from
 */

function getFundingTX(address, value) {
  const cb = new bcoin.MTX();
  cb.addInput({
    prevout: new bcoin.Outpoint(),
    script: new bcoin.Script(),
    sequence: 0xffffffff
  });
  cb.addOutput({
    address: address,
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

(async () => {
  const walletId="primary"
  const wallet = walletClient.wallet(walletId);
  // const walletInfo = await wallet.getInfo();
  // console.log("wallet info:\n", walletInfo, "\n");
  const walletMaster = await wallet.getMaster();
  // console.log("wallet master:\n", walletMaster, "\n");
  // console.log("xprivkey:       ", walletMaster.key.xprivkey);
  // console.log("mnemonic.phrase:", walletMaster.mnemonic.phrase);

  const recoveredMasterKey = recoverMasterFromMnemonic(walletMaster.mnemonic.phrase);
  const recoveredMasterKey1 = recoveredMasterKey.derivePath('m/44/0/0/0/0');
  const recoveredMasterKey2 = recoveredMasterKey.derivePath('m/44/0/0/0/1');//TODO: use another wallet and another account, or better check Algorand for this pair
  const sellerKeyPair = getKeyPair(recoveredMasterKey1.privateKey);
  const buyerKeyPair = getKeyPair(recoveredMasterKey2.privateKey);
  // console.log("sellerKeyPair:", sellerKeyPair);
  // console.log("buyerKeyPair:", buyerKeyPair);


  const hour = 60 * 60;
  const CSV_LOCKTIME = 0.05 * hour; // can't spend redeem until this time passes
  const TX_nSEQUENCE = 0.1 * hour; // minimum passed time before redeem tx valid
  const secret = createSecret();
  // console.log("secret:     ", secret.secret);
  // console.log("secret hash:", secret.hash);

  // const account = await wallet.getAccount('default');
  // // console.log(account);
  // let result = await wallet.getKey(account.receiveAddress);
  // console.log(result);
  // result = await wallet.getWIF(account.receiveAddress);
  // console.log(result);
  // result = await wallet.getKey("mguLB4Zhkm7BbsuHhbiSToLnwXiM6cafey");
  // console.log(result);
  // result = await wallet.getWIF("mguLB4Zhkm7BbsuHhbiSToLnwXiM6cafey");
  // console.log(result);
  // result = await wallet.getKey("mwJzGesMqBWGJzNtMuvpZfy7wDA2bo125t");
  // console.log(result);
  // result = await wallet.getKey("n14iNH6FRiFtBwy2q76EnYsHH4ww4c8aNV");
  // console.log(result);

  const redeemScript = createRedeemScript(secret.hash, sellerKeyPair.publicKey, buyerKeyPair.publicKey, CSV_LOCKTIME);
  // console.log("redeem script:", redeemScript);

  const refundScript = createRefundInputScript(redeemScript);
  // console.log("refund script:", refundScript);

  // wrap redeem script in P2SH address
  const addressFromRedeemScript = getAddressFromRedeemScript(redeemScript);
  // console.log('Swap P2SH address:', addressFromRedeemScript.toString());

  // const coinBase = await wallet.getCoins();
  // console.log("coinBase:", coinBase);

  // console.log("coins[0].hash:", coins[0].hash);
  // const result = await wallet.getTX(coinBase[0].hash);
  // const result = await nodeClient.getTX(coins[0].hash);
  // const result = await nodeClient.getCoin(coins[0].hash, 0);
  // console.log("fundingTX:", result);
  const fundingTX = getFundingTX(addressFromRedeemScript, 10000);
  console.log("fundingTX:", fundingTX);

  // make sure we can determine which UTXO funds the HTLC
  const fundingTXoutput = extractOutput(fundingTX, addressFromRedeemScript);
  console.log('Funding TX output:\n', fundingTXoutput);

  const refundScriptdTX = createRedeemTX(
      sellerKeyPair.address,
      10000,
      fundingTX,
      fundingTXoutput.index,
      redeemScript,
      refundScript,
      TX_nSEQUENCE,
      sellerKeyPair.privateKey
  );
  // console.log('refundTX:\n', refundTX);

  // console.log('\nREFUND VERIFY:\n', verifyMTX(refundTX));

  const swapScript = createSwapInputScript(redeemScript, secret.secret);
  const swapTX = createRedeemTX(
      buyerKeyPair.address,
      10000,
      fundingTX,
      fundingTXoutput.index,
      redeemScript,
      swapScript,
      null,
      buyerKeyPair.privateKey
  );
  // console.log('swapTX:\n', swapTX);
  // console.log('\nSWAP VERIFY:\n', verifyMTX(swapTX));

  // test that we can extract the HTLC secret from the SWAP redemption
  const extractedSecret = extractSecret(swapTX, addressFromRedeemScript);
  console.log('\nExtracted HTLC secret:\n', extractedSecret);
  // make sure we ended up with the same secret we started with
  console.log('Secret match:\n', extractedSecret === secret.secret);

  // const result = await wallet.getPending();
  // console.log(result);
  //
  // const result = await wallet.getHistory("default");
  // console.log(result);


  // await printAccountInfo("default");
  // await printAccountInfo("second");
})();