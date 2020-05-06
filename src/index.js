'use strict';

const bcoin = require('bcoin').set('testnet');
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

async function generateSellerAndBuyerKeyPairs(wallet) {
  const walletMaster = await wallet.getMaster();
  const recoveredMasterKey = utils.recoverMasterFromMnemonic(walletMaster.mnemonic.phrase);
  const recoveredMasterKey1 = recoveredMasterKey.derivePath('m/44/0/0/0/0');
  const recoveredMasterKey2 = recoveredMasterKey.derivePath('m/44/0/0/0/1');//TODO: use another wallet and another account, or better check Algorand for this pair
  const sellerKeyPair = utils.getKeyPair(recoveredMasterKey1.privateKey);
  const buyerKeyPair = utils.getKeyPair(recoveredMasterKey2.privateKey);
  return {seller: sellerKeyPair, buyer: buyerKeyPair}
}

(async () => {
  const wallet = walletClient.wallet("primary");
  const {seller, buyer} = await generateSellerAndBuyerKeyPairs(wallet);
  console.log("seller:", seller);
  console.log("buyer:", buyer);

  const hour = 60 * 60;
  const CSV_LOCKTIME = 0.05 * hour; // can't spend redeem until this time passes, 3 min
  const TX_nSEQUENCE = 0.1 * hour; // minimum passed time before redeem tx valid, 6 min
  const secret = utils.createSecret();
  console.log("secret:     ", secret.secret);
  console.log("secret hash:", secret.hash);

  const redeemScript = utils.createRedeemScript(secret.hash, seller.publicKey, buyer.publicKey, CSV_LOCKTIME);
  console.log("redeem script:", redeemScript);

  const refundScript = utils.createRefundInputScript(redeemScript);
  console.log("refund script:", refundScript);

  const swapScript = utils.createSwapInputScript(redeemScript, secret.secret);
  console.log("swap script:", swapScript);

  // wrap redeem script in P2SH address
  const address = utils.getAddressFromRedeemScript(redeemScript);
  console.log('Swap P2SH address:', address.toString());

  // const coinBase = await wallet.getCoins();
  // console.log("coinBase:", coinBase);

  // console.log("coins[0].hash:", coins[0].hash);
  // const result = await wallet.getTX(coinBase[0].hash);
  // const result = await nodeClient.getTX(coins[0].hash);
  // const result = await nodeClient.getCoin(coins[0].hash, 0);
  // console.log("fundingTX:", result);
  const fundingTX = utils.getFundingTX(address, 10000);
  console.log("fundingTX:", fundingTX);

  // make sure we can determine which UTXO funds the HTLC
  const fundingTXoutput = utils.extractOutput(fundingTX, address);
  console.log('Funding TX output:\n', fundingTXoutput);

  const refundTX = utils.createRedeemTX(
      seller.address,
      10000,
      fundingTX,
      fundingTXoutput.index,
      redeemScript,
      refundScript,
      TX_nSEQUENCE,
      seller.privateKey
  );
  console.log('refundTX:\n', refundTX);
  console.log('\nREFUND VERIFY:\n', utils.verifyMTX(refundTX));

  const swapTX = utils.createRedeemTX(
      buyer.address,
      10000,
      fundingTX,
      fundingTXoutput.index,
      redeemScript,
      swapScript,
      null,
      buyer.privateKey
  );
  console.log('swapTX:\n', swapTX);
  console.log('\nSWAP VERIFY:\n', utils.verifyMTX(swapTX));

  // test that we can extract the HTLC secret from the SWAP redemption
  const extractedSecret = utils.extractSecret(swapTX, address);
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