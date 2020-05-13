'use strict';

const bcoin = require('bcoin').set('testnet');
const apiKey = process.env.BCOIN_API_KEY;
const network = bcoin.Network.get('testnet');
const utils = require("./utils.js")
const fs = require('fs');
const assert = require('assert');

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
const ownerMasterKey = ownerWallet.derivePath('m/44/0/0/0/0');
const receiverWallet = utils.recoverMasterFromMnemonic(receiver.mnemonic);
const receiverMasterKey = receiverWallet.derivePath('m/44/0/0/0/0');

const hour = 60 * 60;
const CSV_LOCKTIME = 0.05 * hour; // can't spend redeem until this time passes, 3 min
const TX_nSEQUENCE = 0.1 * hour; // minimum passed time before redeem tx valid, 6 min

owner.keyPair = utils.getKeyPair(ownerMasterKey.privateKey);
receiver.keyPair = utils.getKeyPair(receiverMasterKey.privateKey);

// console.log("owner: %o", owner);
// console.log("receiver: %o", receiver);

async function checkOwnerCase(contractAddress, fundingTxHash) {
  const recoveredContractScript = utils.deserializeContract(contractAddress);
  const scriptForOwner = utils.createRefundInputScript(recoveredContractScript);

  const fundingTXJson = await nodeClient.getTX(fundingTxHash);
  const fundingTX = bcoin.TX.fromJSON(fundingTXJson);
  console.log("fundingTX:", fundingTX);

  // make sure we can determine which UTXO funds the HTLC
  const fundingTXoutput = utils.extractOutput(fundingTX, contractAddress);
  console.log('Funding TX output:\n', fundingTXoutput);

  const refundTX = utils.createRedeemTX(
      owner.keyPair.address,
      10000,
      fundingTX,
      fundingTXoutput.index,
      recoveredContractScript,
      scriptForOwner,
      TX_nSEQUENCE,
      owner.keyPair.privateKey
  );
  console.log('refundTX: %o', refundTX);
  // console.log('refundTX is MTX: %o', bcoin.MTX.isMTX(refundTX));
  let isValid = utils.verifyMTX(refundTX);
  console.log("isValid: %s", isValid);
  let rawTX = refundTX.toRaw().toString('hex');
  console.log('rawTX: %s', rawTX);

  if (isValid) {
    const result = await nodeClient.broadcast(rawTX);
    console.log("broadcasted: %o", result);
  }
}

async function checkReceiverCase(contractAddress, fundingTxHash, secret) {
  const recoveredContractScript = utils.deserializeContract(contractAddress);
  const scriptForReceiver = utils.createSwapInputScript(recoveredContractScript, secret);

  const fundingTXJson = await nodeClient.getTX(fundingTxHash);
  const fundingTX = bcoin.TX.fromJSON(fundingTXJson);
  console.log("fundingTX:", fundingTX);

  // make sure we can determine which UTXO funds the HTLC
  const fundingTXoutput = utils.extractOutput(fundingTX, contractAddress);
  console.log('Funding TX output:\n', fundingTXoutput);

  const swapTX = utils.createRedeemTX(
      receiver.keyPair.address,
      10000,
      fundingTX,
      fundingTXoutput.index,
      recoveredContractScript,
      scriptForReceiver,
      null,
      receiver.keyPair.privateKey
  );
  console.log('swapTX:\n', swapTX);
  let isValid = utils.verifyMTX(swapTX);
  console.log("isValid: %s", isValid);
  let rawTX = swapTX.toRaw().toString('hex');
  console.log('rawTX: %s', rawTX);


  if (isValid) {
    const result = await nodeClient.broadcast(rawTX);
    console.log("broadcasted: %o", result);
  }
}

(async () => {
  // [PART 1] Generate contract and serialize it, we need to fund it before using
  // const secret = utils.createSecret('aaaaffffaaaaffffaaaaffffaaaaffff');
  // console.log("secret:     ", secret.secret);
  // console.log("secret hash:", secret.hash);//
  // const contractScript = utils.createRedeemScript(secret.hash, owner.keyPair.publicKey, receiver.keyPair.publicKey, CSV_LOCKTIME);
  // const contractAddress = utils.getAddressFromRedeemScript(contractScript);
  // console.log('contractAddress:', contractAddress.toString());
  // utils.serializeContract(contractScript, contractAddress)

  // [PART 2] Use dispenser for funding: https://tbtc.bitaps.com/ or send from your wallet if you have funds
  // Fund contract, comment part 1, part 2, and uncomment part 3
  // const contractAddress = '2MuDQ7YF2TRCr1WNNF9sbMyUd1goSit5Fog'; //place your contract address here
  // let changeAddress = "myz1QGZmbYpPLnYcZzsxGjpFB3FkZwumZT"; //place your change address here
  // await utils.sendTransaction(10000, contractAddress, changeAddress)

  // [PART 3]
  // Owner's Case
  // const contractAddress = '2NB7jUtcpwXPvm1QyPTCWGAz11dVBAiErNS'; //place your contract address here
  // const fundingTxHash = '956248b787f0b576055d5b322b23b1aba583f9bd6e1fbeab7c241e1399305dd3'; //place the transactions that funds the contract address
  // await checkOwnerCase(contractAddress, fundingTxHash);

  // Receiver's case
  const secret = 'aaaaffffaaaaffffaaaaffffaaaaffff';
  const contractAddress = '2MuDQ7YF2TRCr1WNNF9sbMyUd1goSit5Fog'; //place your contract address here
  const fundingTxHash = '05c132208796c4ce454abe7c1761ec1ad36af275fdcc95b0afd32e4b063350a0'; //place the transactions that funds the contract address
  await checkReceiverCase(contractAddress, fundingTxHash, secret);
})();