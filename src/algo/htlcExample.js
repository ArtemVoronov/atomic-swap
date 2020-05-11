'use strict';

const server = '127.0.0.1';
const port = '8080';
const token = process.env.ALGO_API_TOKEN;
const utils = require("./utils.js")

const algosdk = require('algosdk');
const fs = require('fs');
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

async function createHTLContractWithHashingSHA256(ownerAddress, receiverAddress, timeLockInRounds = 700) {
  let params = await algodclient.getTransactionParams();
  const hashFn = "sha256";
  let hashImg = "QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=";
  let expiryRound = params.lastRound + timeLockInRounds;
  console.log("expiryRound: %s", expiryRound);
  let maxFee = 2000;
  return new htlcTemplate.HTLC(ownerAddress, receiverAddress, hashFn, hashImg, expiryRound, maxFee);
}

async function createTxForReceiver(contract, receiverAddress, secret, params) {
  utils.createDataDirsIfNeeds();
  let endRound = params.lastRound + parseInt(1000);
  let args = [secret];
  let lsig = algosdk.makeLogicSig(contract.programBytes, args);
  let txn = {
    "from": contract.address,
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
  return algosdk.signLogicSigTransaction(txn, lsig);
}

function createTxForOwner(contract, ownerAddress, params) {
  utils.createDataDirsIfNeeds();
  let endRound = params.lastRound + parseInt(1000);
  let args = [""];
  let lsig = algosdk.makeLogicSig(contract.programBytes, args);
  let txn = {
    "from": contract.address,
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
  return algosdk.signLogicSigTransaction(txn, lsig);
}

//for debugging of transactions via 'goal clerk dryrun'
function serializeTransaction(rawSignedTxn, filename) {
  let txnPath = utils.ALGO_TRANSACTIONS_DIR_PATH + filename + ".stxn";
  fs.writeFileSync(txnPath, rawSignedTxn.blob);
  return txnPath;
}
//for debugging of transactions via 'goal clerk dryrun'
function deserializeTransactionBlob(txnPath) {
  let singedTxBlob = fs.readFileSync(txnPath);
}

async function executeTxn(txnBlob) {
  try {
    let tx = (await algodclient.sendRawTransaction(txnBlob));
    console.log("Transaction: %s", tx.txId);
  } catch (e) {
    console.log(e);
  }
}

function serializeContract(contract) {
  utils.createDataDirsIfNeeds();
  let buffer = contract.getProgram();
  let address = contract.getAddress();
  let contractBufferPath = utils.ALGO_CONTRACTS_DIR_PATH + "buffer" + address;
  fs.writeFileSync(contractBufferPath, buffer);
  return contractBufferPath;
}

function deserializeContract(contractAddress) {
  let contractBufferPath = utils.ALGO_CONTRACTS_DIR_PATH + "buffer" + contractAddress;
  let buffer = new Buffer(fs.readFileSync(contractBufferPath));
  return {
    programBytes: buffer,
    address: contractAddress
  }
}

(async() => {

  // [PART 1] Generate contract and serialize it, we need to fund it before using

  let contract = await createHTLContractWithHashingSHA256(owner.address, receiver.address, 100);
  console.log("contract address: %s", contract.address);
  serializeContract(contract);

  // [PART 2] Use dispenser for funding: https://bank.testnet.algorand.network/
  // Fund contract, comment part 1 and uncomment part 3

  // [PART 3] Recover contract and initiate appropriate transaction (for owner or for receiver)
  // let contractAddress = 'ODUVUBTLRFKYSAVJOQK2UHEKHEQDWRP3ZHMIKT3ZJNIYFGU2VJTPBOSKJ4'; //place your contract address here
  // let recoveredContract = deserializeContract(contractAddress)
  // console.log('recovered contract: %o', recoveredContract);
  //
  // const secret = "hero wisdom green split loop element vote belt";
  // let params = await algodclient.getTransactionParams();
  //
  // //scenario 1
  // let receiverTx= await createTxForReceiver(recoveredContract, receiver.address, secret, params);
  // await executeTxn(receiverTx.blob);
  //
  // //scenario 2
  // let ownerTx = await createTxForOwner(recoveredContract, owner.address, params);
  // await executeTxn(ownerTx.blob);


})().catch(e => {
  console.log(e);
});