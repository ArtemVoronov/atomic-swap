'use strict';

const algosdk = require('algosdk');
const fs = require('fs');

function generateAlgorandKeyPair() {
  var account = algosdk.generateAccount();
  var passphrase = algosdk.secretKeyToMnemonic(account.sk);
  // console.log("address: " + account.addr );
  // console.log("passphrase: " + passphrase );
  return {account: account, passphrase: passphrase};
}


async function waitForConfirmation(algodclient, txId) {
  while (true) {
    let lastround = (await algodclient.status()).lastRound;
    let pendingInfo = await algodclient.pendingTransactionInformation(txId);
    if (pendingInfo.round != null && pendingInfo.round > 0) {
      //Got the completed Transaction
      console.log("Transaction " + pendingInfo.tx + " confirmed in round " + pendingInfo.round);
      break;
    }
    await algodclient.statusAfterBlock(lastround + 1);
  }
}

function createDataDirIfNeeds() {
  if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data');
  }
  if (!fs.existsSync('./data/algo')) {
    fs.mkdirSync('./data/algo');
  }
}

module.exports = {
  generateAlgorandKeyPair: generateAlgorandKeyPair,
  waitForConfirmation: waitForConfirmation,
  createDataDirIfNeeds: createDataDirIfNeeds,
}