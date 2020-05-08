'use strict';

const algosdk = require('algosdk');

const server = '127.0.0.1';
const port = '8080';
const token = process.env.ALGO_API_TOKEN;

let algodclient = new algosdk.Algod(token, server, port);
async function connectToNetwork() {

  let status = await algodclient.status();
  console.log("Algorand network status: %o", status);
  let version = await algodclient.versions();
  // console.log("Algorand protocol version: %o", version);


  const passphrase = "injury say input naive hole festival tomato rotate festival monster number park filter kind sting away dose toilet sign trap source claim harbor absent track";
  let myAccount = algosdk.mnemonicToSecretKey(passphrase);
  console.log("My address: %s", myAccount.addr);
  let accountInfo = await algodclient.accountInformation(myAccount.addr);
  console.log("Account balance: %d microAlgos", accountInfo.amount);


  let params = await algodclient.getTransactionParams();
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

  // uncomment for repeating
  // await algodClient.sendRawTransaction(signedTxn.blob);
  // await waitForConfirmation(algodClient, txId);

  //Transaction UAWBWKWSVIKOU3FCZU7OCLG3F6F5KZCRSUBUR4GR3TXCDFSWTB2A confirmed in round 6610049

  // try {
  //   let confirmedTxn = await algodClient.transactionInformation(myAccount.addr, txId);
  //   console.log("Transaction information: %o", confirmedTxn);
  //   console.log("Decoded note: %s", algosdk.decodeObj(confirmedTxn.note));
  // } catch(e) {
  //   console.log(e.response.text);
  // }
}

async function createContractExample() {

  // get suggested parameters
  let params = await algodclient.getTransactionParams();
  let endRound = params.lastRound + parseInt(1000);
  let fee = await algodclient.suggestedFee();

  // create logic sig
  //cat simple.teal.tok | base64
  //int 0 -> "ASABACI=" (reject always)
  //int 1 -> "ASABASI=" (accept always)s
  let program = new Uint8Array(Buffer.from("ASABASI=", "base64"));
  let lsig = algosdk.makeLogicSig(program);
  let receiver = "GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A"; //faucet contract address

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

  // console.log("rawSignedTxn: %o", rawSignedTxn)
  // send raw LogicSigTransaction to network
  // try {
  //
  //   //let tx = (await algodclient.sendRawTransaction(rawSignedTxn.blob));
  //   console.log("Transaction : " + tx.txId);
  // } catch (e) {
  //   console.log(e);
  // }

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

  // await connectToNetwork();
  await createContractExample();
})();