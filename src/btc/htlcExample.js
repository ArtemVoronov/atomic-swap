'use strict';

const bcoin = require('bcoin').set('testnet');
const apiKey = process.env.BCOIN_API_KEY;
const network = bcoin.Network.get('testnet');
const utils = require("./utils.js")

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
const ownerWallet = utils.recoverMasterFromMnemonic(owner.mnemonic);
const receiverWallet = utils.recoverMasterFromMnemonic(receiver.mnemonic);
const ownerMasterKey = ownerWallet.derivePath('m/44/0/0/0/0');
const receiverMasterKey = receiverWallet.derivePath('m/44/0/0/0/0');

const hour = 60 * 60;
const CSV_LOCKTIME = 0.05 * hour; // can't spend redeem until this time passes, 3 min
const TX_nSEQUENCE = 0.1 * hour; // minimum passed time before redeem tx valid, 6 min

owner.keyPair = utils.getKeyPair(ownerMasterKey.privateKey);
receiver.keyPair = utils.getKeyPair(receiverMasterKey.privateKey);

(async () => {
 console.log("owner: %o", owner);
 console.log("receiver: %o", receiver);
  const secret = utils.createSecret();
  console.log("secret:     ", secret.secret);
  console.log("secret hash:", secret.hash);

  const redeemScript = utils.createRedeemScript(secret.hash, owner.keyPair.publicKey, receiver.keyPair.publicKey, CSV_LOCKTIME);
  const scriptForOwner = utils.createRefundInputScript(redeemScript);
  const scriptForReceiver = utils.createSwapInputScript(redeemScript, secret.secret);
})();