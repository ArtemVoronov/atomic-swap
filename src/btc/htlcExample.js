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

async function checkOwnerCase(contractAddress) {
  const recoveredContractScript = utils.deserializeContract(contractAddress);
  const scriptForOwner = utils.createRefundInputScript(recoveredContractScript);
  const fundingTX = utils.getFundingTX(contractAddress, 10000);
  // console.log("fundingTX:", fundingTX);

  // make sure we can determine which UTXO funds the HTLC
  const fundingTXoutput = utils.extractOutput(fundingTX, contractAddress);
  // console.log('Funding TX output:\n', fundingTXoutput);

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
  let isValid = utils.verifyMTX(refundTX);
  console.log("isValid: %s", isValid);
  console.log('refundTX: %o', refundTX);
  let rawTX = refundTX.toRaw().toString('hex');
  console.log('rawTX: %s', rawTX);

  if (isValid) {
    const result = await nodeClient.broadcast(rawTX);
    console.log("broadcast: %o", result);
  }

  // let rawTX = '02000000018ee57138fd7c7c20adc7e35a62d2ad7c265d1b38e42ed1c6511c990c40f6a40300000000bd47304402204d576f28ea8ce96930475b0605c106d8effed0a45c5b6dfb4d577d3cd10dd7b3022019a26c953134065e4321281a6a5e1640057bf119f788b146e8a8346e69b05e4d01004c7263a8202340b1af64ea7604ad1db689e623b51da5fda3e9e953c40183d58298ab9c214188210384759376831f2f669ac816286dc364fe4888911b2ff2d02d0a101154a9113f00ac6703000040b27521036c34f5820e8f8b1d192e20858516ae4871a24546f3578b72089271e82ee8c964ac68000040000100000000000000001976a914fbc309e205dd0cab68970636b97b1b72fe14693288ac00000000';
  // const result = await nodeClient.broadcast(rawTX);//TODO: solve problem with stucked tx
  // console.log("broadcast: %o", result);
}

async function checkReceiverCase(contractAddress) {
  // const scriptForReceiver = utils.createSwapInputScript(redeemScript, secret.secret);
  // TODO ...
}

(async () => {
  // [PART 1] Generate contract and serialize it, we need to fund it before using
  // const secret = utils.createSecret();
  // // console.log("secret:     ", secret.secret);
  // // console.log("secret hash:", secret.hash);//
  // const contractScript = utils.createRedeemScript(secret.hash, owner.keyPair.publicKey, receiver.keyPair.publicKey, CSV_LOCKTIME);
  // const contractAddress = utils.getAddressFromRedeemScript(contractScript);
  // console.log('contractAddress:', contractAddress.toString());
  // utils.serializeContract(contractScript, contractAddress)

  // [PART 2] Use dispenser for funding: https://tbtc.bitaps.com/ or send from your wallet if you have funds
  // Fund contract, comment part 1 and uncomment part 3
  // const contractAddress = ''; //place your contract address here
  // let changeAddress = ""; //place your change address here
  // await utils.sendTransaction(10000, contractAddress, changeAddress)

  // [PART 3]
  // Owner's Case
  const contractAddress = '2MyiLtqM1eMKF1WXGngbBVKbd2YRnTQNZvf'; //place your contract address here
  await checkOwnerCase(contractAddress);

  // Receiver's case
  // checkReceiverCase(contractAddress);
})();