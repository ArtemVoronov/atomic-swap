'use strict';

const bcoin = require('bcoin').set('testnet');
const bcrypto = require('bcrypto');
const apiKey = process.env.BCOIN_API_KEY;
const network = bcoin.Network.get('testnet');
const utils = require("./utils.js")

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

(async () => {
  const walletId="primary"
  const wallet = walletClient.wallet(walletId);
  // const walletInfo = await wallet.getInfo();
  // console.log("wallet info:\n", walletInfo, "\n");
  const walletMaster = await wallet.getMaster();
  // console.log("wallet master:\n", walletMaster, "\n");
  // console.log("xprivkey:       ", walletMaster.key.xprivkey);
  // console.log("mnemonic.phrase:", walletMaster.mnemonic.phrase);

  const recoveredMasterKey = utils.recoverMasterFromMnemonic(walletMaster.mnemonic.phrase);
  const recoveredMasterKey1 = recoveredMasterKey.derivePath('m/44/0/0/0/0');
  const recoveredMasterKey2 = recoveredMasterKey.derivePath('m/44/0/0/0/1');//TODO: use another wallet and another account, or better check Algorand for this pair
  const sellerKeyPair = utils.getKeyPair(recoveredMasterKey1.privateKey);
  const buyerKeyPair = utils.getKeyPair(recoveredMasterKey2.privateKey);
  // console.log("sellerKeyPair:", sellerKeyPair);
  // console.log("buyerKeyPair:", buyerKeyPair);


  const hour = 60 * 60;
  const CSV_LOCKTIME = 0.05 * hour; // can't spend redeem until this time passes
  const TX_nSEQUENCE = 0.1 * hour; // minimum passed time before redeem tx valid
  const secret = utils.createSecret();
  // console.log("secret:     ", secret.secret);
  // console.log("secret hash:", secret.hash);

  // const account = await wallet.getAccount('default');
  // // console.log(account);
  // let result = await wallet.getKey(account.receiveAddress);
  // console.log(result);
  // result = await wallet.getWIF(account.receiveAddress);
  // console.log(result);
  // result = await wallet.getKey("mguLB4Zhkm7BbsuHhbiSToLnwXiM6cafey");
  // console.log(result);
  // result = await wallet.getWIF("mguLB4Zhkm7BbsuHhbiSToLnwXiM6cafey");
  // console.log(result);
  // result = await wallet.getKey("mwJzGesMqBWGJzNtMuvpZfy7wDA2bo125t");
  // console.log(result);
  // result = await wallet.getKey("n14iNH6FRiFtBwy2q76EnYsHH4ww4c8aNV");
  // console.log(result);

  const redeemScript = utils.createRedeemScript(secret.hash, sellerKeyPair.publicKey, buyerKeyPair.publicKey, CSV_LOCKTIME);
  // console.log("redeem script:", redeemScript);

  const refundScript = utils.createRefundInputScript(redeemScript);
  // console.log("refund script:", refundScript);

  // wrap redeem script in P2SH address
  const addressFromRedeemScript = utils.getAddressFromRedeemScript(redeemScript);
  // console.log('Swap P2SH address:', addressFromRedeemScript.toString());

  // const coinBase = await wallet.getCoins();
  // console.log("coinBase:", coinBase);

  // console.log("coins[0].hash:", coins[0].hash);
  // const result = await wallet.getTX(coinBase[0].hash);
  // const result = await nodeClient.getTX(coins[0].hash);
  // const result = await nodeClient.getCoin(coins[0].hash, 0);
  // console.log("fundingTX:", result);
  const fundingTX = utils.getFundingTX(addressFromRedeemScript, 10000);
  console.log("fundingTX:", fundingTX);

  // make sure we can determine which UTXO funds the HTLC
  const fundingTXoutput = utils.extractOutput(fundingTX, addressFromRedeemScript);
  console.log('Funding TX output:\n', fundingTXoutput);

  const refundScriptdTX = utils.createRedeemTX(
      sellerKeyPair.address,
      10000,
      fundingTX,
      fundingTXoutput.index,
      redeemScript,
      refundScript,
      TX_nSEQUENCE,
      sellerKeyPair.privateKey
  );
  // console.log('refundTX:\n', refundTX);

  // console.log('\nREFUND VERIFY:\n', utils.verifyMTX(refundTX));

  const swapScript = utils.createSwapInputScript(redeemScript, secret.secret);
  const swapTX = utils.createRedeemTX(
      buyerKeyPair.address,
      10000,
      fundingTX,
      fundingTXoutput.index,
      redeemScript,
      swapScript,
      null,
      buyerKeyPair.privateKey
  );
  // console.log('swapTX:\n', swapTX);
  // console.log('\nSWAP VERIFY:\n', verifyMTX(swapTX));

  // test that we can extract the HTLC secret from the SWAP redemption
  const extractedSecret = utils.extractSecret(swapTX, addressFromRedeemScript);
  console.log('\nExtracted HTLC secret:\n', extractedSecret);
  // make sure we ended up with the same secret we started with
  console.log('Secret match:\n', extractedSecret === secret.secret);

  // const result = await wallet.getPending();
  // console.log(result);
  //
  // const result = await wallet.getHistory("default");
  // console.log(result);


  // await printAccountInfo("default");
  // await printAccountInfo("second");
})();