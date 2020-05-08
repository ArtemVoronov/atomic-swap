'use strict';

const algosdk = require('algosdk');

const server = '127.0.0.1';
const port = '8080';
const token = process.env.ALGO_API_TOKEN;

async function connectToNetwork() {

  let algodClient = new algosdk.Algod(token, server, port);
  let status = await algodClient.status();
  console.log("Algorand network status: %o", status);
  let version = await algodClient.versions();
  // console.log("Algorand protocol version: %o", version);


  const passphrase = "injury say input naive hole festival tomato rotate festival monster number park filter kind sting away dose toilet sign trap source claim harbor absent track";
  let myAccount = algosdk.mnemonicToSecretKey(passphrase);
  // console.log("My address: %s", myAccount.addr);
  let accountInfo = await algodClient.accountInformation(myAccount.addr);
  // console.log("Account balance: %d microAlgos", accountInfo.amount);


  let params = await algodClient.getTransactionParams();
  // console.log("Alorand testnet tx params: %o", params);
  let note = algosdk.encodeObj("Hello World");
  let receiver = "GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A"; //faucet contract
  let txn = {
    "from": myAccount.addr,
    "to": receiver,
    "fee": params.minFee,
    "amount": 1000000, //1 algo, here we put value in micro algo units
    "firstRound": params.lastRound,
    "lastRound": params.lastRound + 1000,
    "note": note,
    "genesisID": params.genesisID,
    "genesisHash": params.genesishashb64
  };

  let signedTxn = algosdk.signTransaction(txn, myAccount.sk);
  // console.log("Signed tx: %o", signedTxn);
  let txId = signedTxn.txID;
  console.log("Signed transaction with txId: %s", txId);

  //todo: uncomment after sync with testnet will be finished

  // await algodClient.sendRawTransaction(signedTxn.blob);
  //
  // await waitForConfirmation(algodClient, txId);
  //
  // try {
  //   let confirmedTxn = await algodClient.transactionInformation(myAccount.addr, txId);
  //   console.log("Transaction information: %o", confirmedTxn);
  //   console.log("Decoded note: %s", algosdk.decodeObj(confirmedTxn.note));
  // } catch(e) {
  //   console.log(e.response.text);
  // }
}

async function createContractExample() {
  let algodClient = new algosdk.Algod(token, server, port);

  //cat simple.teal.tok | base64 -> "ASABACI="
  // get suggested parameters
  let params = await algodclient.getTransactionParams();
  let endRound = params.lastRound + parseInt(1000);
  let fee = await algodclient.suggestedFee();

  // create logic sig
  // b64 example "ASABACI="
  let program = new Uint8Array(Buffer.from("ASABACI=", "base64"));
  let lsig = algosdk.makeLogicSig(program);
  let receiver = "GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A"; //faucet contract

  // create a transaction
  let txn = {
    "from": lsig.address(),
    "to": receiver,
    "fee": params.fee,
    "amount": 5,
    "firstRound": params.lastRound,
    "lastRound": endRound,
    "genesisID": params.genesisID,
    "genesisHash": params.genesishashb64
  };

  // Create the LogicSigTransaction with contract account LogicSig
  let rawSignedTxn = algosdk.signLogicSigTransaction(txn, lsig);

  //todo: uncomment after sync with testnet will be finished

  // send raw LogicSigTransaction to network
  // let tx = (await algodclient.sendRawTransaction(rawSignedTxn.blob));
  // console.log("Transaction : " + tx.txId);

}

function generateAlgorandKeyPair() {
  var account = algosdk.generateAccount();
  var passphrase = algosdk.secretKeyToMnemonic(account.sk);
  console.log( "My address: " + account.addr );
  console.log( "My passphrase: " + passphrase );
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

(async () => {

  await connectToNetwork();
})();