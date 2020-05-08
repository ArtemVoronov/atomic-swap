'use strict';

const server = '127.0.0.1';
const port = '8080';
const token = process.env.ALGO_API_TOKEN;
const utils = require("./utils.js")

const algosdk = require('algosdk');
const fs = require('fs');
const fse = require('fs-extra');
const htlcTemplate = require("algosdk/src/logicTemplates/htlc");

let algodclient = new algosdk.Algod(token, server, port);
//generated via utils.generateAlgorandKeyPair()
const owner = {
  address: 'LOI3BVC54WT6RS3OZFLLBI3SZ7ROBVIHFHCJYTVCIZ4VR7CZ5DTMGEOPZI',
  passphrase: 'injury say input naive hole festival tomato rotate festival monster number park filter kind sting away dose toilet sign trap source claim harbor absent track'
}
const receiver = {
  address: 'HCYPBSWCVKZBEQCRDYG7XCDFFOLQ5XPBTFIHXD2S3OUVZG6SXI3VGISRDE',
  passphrase: 'kitten escape chest arrest voyage equal head hybrid vintage solution heavy garage learn lesson rhythm bag exhaust text health net damp size oblige absent clean'
}
console.log("owner address: %s", owner.address);
console.log("receiver address: %s", receiver.address);

async function createHTLContractWithHashingSHA256(ownerAddress, receiverAddress, params) {
  const hashFn = "sha256";
  let hashImg = "QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=";
  let expiryRound = params.lastRound + 30;//10000
  console.log("expiryRound: %s", expiryRound);
  let maxFee = 2000;
  return new htlcTemplate.HTLC(ownerAddress, receiverAddress, hashFn, hashImg, expiryRound, maxFee);
}

async function createTxForReceiver(contract, receiverAddress, secret, params) {
  utils.createDataDirIfNeeds();
  let endRound = params.lastRound + parseInt(1000);
  let args = [secret];
  let lsig = algosdk.makeLogicSig(contract.getProgram(), args);
  let txn = {
    "from": contract.getAddress(),
    "to": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ",
    "fee": 1,
    "type": "pay",
    "amount": 0,
    "firstRound": params.lastRound,
    "lastRound": endRound,
    "genesisID": params.genesisID,
    "genesisHash": params.genesishashb64,
    "closeRemainderTo": receiverAddress
  };
  let rawSignedTxn = algosdk.signLogicSigTransaction(txn, lsig);
  let txnPath = "data/algo/receiver"+contract.getAddress()+".stxn";
  fs.writeFileSync(txnPath, rawSignedTxn.blob);
  return txnPath;
}

function createTxForOwner(contract, ownerAddress, params) {
  utils.createDataDirIfNeeds();
  let endRound = params.lastRound + parseInt(1000);
  let args = ["nothing"];
  let lsig = algosdk.makeLogicSig(contract.getProgram(), args);
  let txn = {
    "from": contract.getAddress(),
    "to": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ",
    "fee": 1,
    "type": "pay",
    "amount": 0,
    "firstRound": params.lastRound,
    "lastRound": endRound,
    "genesisID": params.genesisID,
    "genesisHash": params.genesishashb64,
    "closeRemainderTo": ownerAddress
  };
  console.log("firstRound: %s", params.lastRound);
  console.log("endRound: %s", endRound);
  let rawSignedTxn = algosdk.signLogicSigTransaction(txn, lsig);
  let txnPath = "data/algo/owner"+contract.getAddress()+".stxn";
  fs.writeFileSync(txnPath, rawSignedTxn.blob);
  return txnPath;
}

async function readTxnAndSendToNetwork(txnPath) {
  let singedTxBlob = fs.readFileSync(txnPath);

  try {
    let tx = (await algodclient.sendRawTransaction(singedTxBlob));
    console.log("Transaction: %s",tx.txId);
  } catch (e) {
    console.log(e);
  }
}


(async() => {

  // First generate contract and transactions for receiver and owner

  // const secret = "hero wisdom green split loop element vote belt";
  let params = await algodclient.getTransactionParams();
  let contract = await createHTLContractWithHashingSHA256(owner.address, receiver.address, params);

  //TODO: do not serialize trsnactions, instean try to save contract, and then use it of lsig
  //TODO: solve problem with deserialization of contract
  console.log('contract: %o', contract);
  let contractPath = 'data/algo/contract'+contract.getAddress()+".json";
  // fs.writeFileSync(contractPath, JSON.stringify(contract), 'utf-8');
  fse.writeJsonSync(contractPath, contract);
  // let recovered = fs.readFileSync(contractPath, 'utf-8');
  let recovered = fse.readJsonSync(contractPath);
  console.log('recovered: %o', recovered);
  // console.log("contract address: %s", contract.address);
  // let ownerTxnPath = await createTxForOwner(contract, owner.address, params);
  // console.log("Owner transaction stored in '%s'", ownerTxnPath);
  // let receiverTxnPath = await createTxForReceiver(contract, receiver.address, secret, params);
  // console.log("Receiver transaction stored in '%s'", receiverTxnPath);

  // Then use testnet dispenser to fund the contract address

  // And then execute tx of receiver
  // await readTxnAndSendToNetwork('data/algo/receiver<place_contract_address>.stxn');
  // Or tx of owner for refunding algos back
  // await readTxnAndSendToNetwork('data/algo/owner<place_contract_address>.stxn');

  // owner address: LOI3BVC54WT6RS3OZFLLBI3SZ7ROBVIHFHCJYTVCIZ4VR7CZ5DTMGEOPZI
  // receiver address: HCYPBSWCVKZBEQCRDYG7XCDFFOLQ5XPBTFIHXD2S3OUVZG6SXI3VGISRDE
  // expiryRound: 6614793
  // contract address: LF3BZDBOBV2HJL3DJ4JGMWTHZTPJMYFHE4JGUDU2W25YWVGP4F3ZUKUOBQ
  // firstRound: 6614763
  // endRound: 6615763
  // Owner transaction stored in 'data/algo/ownerLF3BZDBOBV2HJL3DJ4JGMWTHZTPJMYFHE4JGUDU2W25YWVGP4F3ZUKUOBQ.stxn'
  // Receiver transaction stored in 'data/algo/receiverLF3BZDBOBV2HJL3DJ4JGMWTHZTPJMYFHE4JGUDU2W25YWVGP4F3ZUKUOBQ.stxn'

  // await readTxnAndSendToNetwork('data/algo/ownerLF3BZDBOBV2HJL3DJ4JGMWTHZTPJMYFHE4JGUDU2W25YWVGP4F3ZUKUOBQ.stxn');


  //----------

  // let endRound = params.lastRound + parseInt(1000);
  // let args = ["nothing"];
  // let lsig = algosdk.makeLogicSig(contract.getProgram(), args);
  // let txn = {
  //   "from": contract.getAddress(),
  //   "to": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ",
  //   "fee": 1,
  //   "type": "pay",
  //   "amount": 0,
  //   "firstRound": params.lastRound,
  //   "lastRound": endRound,
  //   "genesisID": params.genesisID,
  //   "genesisHash": params.genesishashb64,
  //   "closeRemainderTo": owner.address
  // };
  // console.log("firstRound: %s", params.lastRound);
  // console.log("endRound: %s", endRound);
  // let rawSignedTxn = algosdk.signLogicSigTransaction(txn, lsig);
  // let txnPath = "data/algo/owner"+contract.getAddress()+".stxn";



})().catch(e => {
  console.log(e);
});