const {WalletClient, Network} = require('bcoin');
const network = Network.get('testnet');
const apiKey = process.env.BCOIN_API_KEY;

const walletOptions = {
  network: network.type,
  port: network.walletPort,
  apiKey: apiKey
}

const walletClient = new WalletClient(walletOptions);
const wallet = walletClient.wallet("primary");


(async () => {
  const result = await wallet.getMaster();
  console.log(result);

  const address = await wallet.createAddress("default");
  console.log(address);
})();