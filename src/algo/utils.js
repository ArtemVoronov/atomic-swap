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

const DATA_DIR_PATH = './data/';
const ALGO_DATA_DIR_PATH = DATA_DIR_PATH + 'algo/';
const ALGO_CONTRACTS_DIR_PATH = ALGO_DATA_DIR_PATH + 'contracts/';
const ALGO_TRANSACTIONS_DIR_PATH = ALGO_DATA_DIR_PATH + 'transactions/';

function createDataDirsIfNeeds() {
  if (!fs.existsSync(DATA_DIR_PATH)) {
    fs.mkdirSync(DATA_DIR_PATH);
  }
  if (!fs.existsSync('./data/algo')) {
    fs.mkdirSync('./data/algo');
  }
  if (!fs.existsSync('./data/algo/contracts')) {
    fs.mkdirSync('./data/algo/contracts');
  }
  if (!fs.existsSync('./data/algo/transactions')) {
    fs.mkdirSync('./data/algo/transactions');
  }
}

module.exports = {
  generateAlgorandKeyPair: generateAlgorandKeyPair,
  waitForConfirmation: waitForConfirmation,
  createDataDirsIfNeeds: createDataDirsIfNeeds,
  ALGO_CONTRACTS_DIR_PATH: ALGO_CONTRACTS_DIR_PATH,
  ALGO_TRANSACTIONS_DIR_PATH: ALGO_TRANSACTIONS_DIR_PATH
}