'use strict';

const server = '127.0.0.1';
const port = '8080';
const token = process.env.ALGO_API_TOKEN;
const utils = require("./utils.js")
const addrezz = require('algosdk/src/encoding/address');

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


(async() => {
  // let params = await algodclient.getTransactionParams();
  // let endRound = params.lastRound + parseInt(1000);
  // let fee = await algodclient.suggestedFee();
  // // Inputs
  // let ownerAddress = owner.address;
  // let receiverAddress = receiver.address;
  // let hashFn = "sha256";
  // let hashImg = "QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=";
  // let expiryRound = params.lastRound + 10000;
  // let maxFee = 2000;
  // // Instaniate the template
  // let htlc = new htlcTemplate.HTLC(ownerAddress, receiverAddress, hashFn, hashImg, expiryRound, maxFee);
  // // Outputs
  // let program = htlc.getProgram();
  // let htlcAddress = htlc.getAddress();
  // // let htlcAddress2 = '3H2GBWXJ7DVHHKB7WXB2DQYNSXUZJQJTGPRVCH2PHBHCZHNHXBU63XSGLE'
  // // let htlcAddress3 = 'TZDNQ4CEVTGBJQLMBSJTIH3VPIWQY2YV456L22ZJUJIUBPUMM625MJFNYA'
  // console.log("htlc address: " + htlcAddress);
  //
  //
  //
  // let args = ["hero wisdom green split loop element vote belt"];
  // // let args = [];
  // let lsig = algosdk.makeLogicSig(program, args);
  //
  // // create a transaction
  // let txn = {
  //   "from": htlcAddress,
  //   "to": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ",
  //   "fee": 1,
  //   "type": "pay",
  //   "amount": 0,
  //   "firstRound": params.lastRound,
  //   "lastRound": endRound,
  //   "genesisID": params.genesisID,
  //   "genesisHash": params.genesishashb64,
  //   "closeRemainderTo": receiverAddress
  // };
  // // create logic signed transaction.
  // let rawSignedTxn = algosdk.signLogicSigTransaction(txn, lsig);
  // file.writeFileSync("test.stxn", rawSignedTxn.blob);
  let blobbb = fs.readFileSync('test.stxn');
  console.log("blobbb: %o", blobbb);

  // Submit the lsig signed transaction
  try {
    let tx = (await algodclient.sendRawTransaction(blobbb));
    console.log("Transaction : " + tx.txId);
  } catch (e) {
    console.log(e);
  }

  // // await utils.waitForConfirmation(algodclient, tx.txId);
})().catch(e => {
  console.log(e);
});