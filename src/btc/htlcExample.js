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

  // [PART 3]
  const contractAddress = '2MtqvQZmLgGknfsjPy53W74hhzfkdrUyYJf'; //place your contract address here
  const recoveredContractScript = deserializeContract(contractAddress);

  // const scriptForOwner = utils.createRefundInputScript(redeemScript);
  // const scriptForReceiver = utils.createSwapInputScript(redeemScript, secret.secret);
})();