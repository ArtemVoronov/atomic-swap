'use strict';

const algosdk = require('algosdk');

async function connectToNetwork() {

  const server = '127.0.0.1';
  const port = '8080';
  const token = '175615008d7372c95a33fb64f2c7af4e5a4a75fa1bccf24b94fcb7183117529b';

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
  let receiver = "GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A";
  let txn = {
    "from": myAccount.addr,
    "to": receiver,
    "fee": params.minFee,
    "amount": 1000000,
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