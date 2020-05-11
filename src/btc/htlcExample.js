'use strict';

const bcoin = require('bcoin').set('testnet');
const apiKey = process.env.BCOIN_API_KEY;
const network = bcoin.Network.get('testnet');
const utils = require("./utils.js")
const fs = require('fs');

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

//generated via new bcion.hd.Mnemonic({bits: 128});
const owner = {
  mnemonic: 'duck bulk private noodle enact box cancel crop violin rescue typical fine'
};
const receiver = {
  mnemonic: 'twenty fluid symbol cable myth protect square network join keep possible fashion'
};

// const ownerWalletClientObject = walletClient.wallet("primary");
const ownerWallet = utils.recoverMasterFromMnemonic(owner.mnemonic);
const ownerMasterKey = ownerWallet.derivePath('m/44/0/0/0/0');
const receiverWallet = utils.recoverMasterFromMnemonic(receiver.mnemonic);
const receiverMasterKey = receiverWallet.derivePath('m/44/0/0/0/0');

const hour = 60 * 60;
const CSV_LOCKTIME = 0.05 * hour; // can't spend redeem until this time passes, 3 min
const TX_nSEQUENCE = 0.1 * hour; // minimum passed time before redeem tx valid, 6 min

owner.keyPair = utils.getKeyPair(ownerMasterKey.privateKey);
receiver.keyPair = utils.getKeyPair(receiverMasterKey.privateKey);

// ...
// console.log("owner: %o", owner);
// console.log("receiver: %o", receiver);

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

function createRedeemTX(address, fee, fundingTX, fundingTXoutput, redeemScript, inputScript, locktime, privateKey) {
  // Init and check input
  const redeemTX = new bcoin.MTX();
  privateKey = utils.ensureBuffer(privateKey);

  // Add coin (input UTXO to spend) from HTLC transaction output
  const coin = bcoin.Coin.fromTX(fundingTX, 0, -1);
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
  privateKey = utils.ensureBuffer(privateKey);
  return mtx.signature(index, redeemScript, value, privateKey, sigHashType, version_or_flags);
}

(async () => {
  // [PART 1] Generate contract and serialize it, we need to fund it before using
  // const secret = utils.createSecret();
  // console.log("secret:     ", secret.secret);
  // console.log("secret hash:", secret.hash);//
  // const contractScript = utils.createRedeemScript(secret.hash, owner.keyPair.publicKey, receiver.keyPair.publicKey, CSV_LOCKTIME);
  // const contractAddress = utils.getAddressFromRedeemScript(contractScript);
  // console.log('contractAddress:', contractAddress.toString());
  // serializeContract(contractScript, contractAddress)

  // [PART 2] Use dispenser for funding: https://tbtc.bitaps.com/
  // Fund contract, comment part 1 and uncomment part 3
  // const contractAddress = '2MtqvQZmLgGknfsjPy53W74hhzfkdrUyYJf'; //place your contract address here
  // let changeAddress = "n2Ghr8Xz2bqMvpQrz9apd9k8Qux3nhC4d2"; //place your change address here
  // await sendTransaction(10000, contractAddress, changeAddress)

  // [PART 3]
  const contractAddress = '2MtqvQZmLgGknfsjPy53W74hhzfkdrUyYJf'; //place your contract address here
  const recoveredContractScript = deserializeContract(contractAddress);
  const wallet = walletClient.wallet('primary');
  // const coins = await wallet.getCoins();
  // const coin = await wallet.getCoin('65671dcb368f97cd524c6421647bade89ce759c0a2155e0340153cc327b672dc', 0);
  // console.log(coins);
  // console.log(coin);

  const scriptForOwner = utils.createRefundInputScript(recoveredContractScript);
  const fundingTX = getFundingTX(contractAddress, 10000);
  // console.log("fundingTX:", fundingTX);

  // make sure we can determine which UTXO funds the HTLC
  const fundingTXoutput = extractOutput(fundingTX, contractAddress);
  // console.log('Funding TX output:\n', fundingTXoutput);

  const refundTX = createRedeemTX(
      owner.address,
      10000,
      fundingTX,
      fundingTXoutput.index,
      recoveredContractScript,
      scriptForOwner,
      TX_nSEQUENCE,
      owner.keyPair.privateKey
  );
  // console.log(utils.verifyMTX(refundTX));
  //
  // console.log(refundTX.toRaw().toString('hex'));
  // console.log('refundTX: %o', refundTX);

  let tx_hex = '0200000001b068b2ccca22a3a1c9e967da6785e03d622f4f8d767ebde5b83b4580dde3ee2400000000be483045022100d59433a509e4db862c7b78e7607c604488fed4eb84ea27f32b3446f59f73e23102204453b4f467141ebf1b46dcf26e1c123e92547ddac733d26646c9c76bd124497301004c7263a820e5b7eb16b88ed77217ab2895769cf8f7aef81e52918c18df6b505615f9e8efb288210384759376831f2f669ac816286dc364fe4888911b2ff2d02d0a101154a9113f00ac6703000040b27521036c34f5820e8f8b1d192e20858516ae4871a24546f3578b72089271e82ee8c964ac68000040000100000000000000000000000000';

  // const tx = refundTX.toTX();
  // console.log(tx);

  const result = await nodeClient.execute('decoderawtransaction', [tx_hex]);
  console.log(result);
  // const result = await nodeClient.execute('sendrawtransaction', [ tx_hex ]);
  // console.log(result);

  // SEND
  // f387e0499e20d93879102050d9f406322c685bacc78d65fdd9fedc0b40cdeeec
  // const scriptForReceiver = utils.createSwapInputScript(redeemScript, secret.secret);
})();