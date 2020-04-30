const bcoin = require('bcoin').set('testnet');
const apiKey = process.env.BCOIN_API_KEY;
const network = bcoin.Network.get('testnet');
const Mnemonic = bcoin.hd.Mnemonic;
const HD = bcoin.hd;

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
const wallet = walletClient.wallet("primary");

async function createWalletFromMnemonics(mnemonicStr) {
  const wdb = new bcoin.WalletDB({ db: 'memory' });
  await wdb.open();
  const mnemonic = new Mnemonic(mnemonicStr);
  const masterKey = HD.fromMnemonic(mnemonic);
  return await wdb.create({master: masterKey});
}

(async () => {
  const result = await wallet.getMaster();
  console.log("original master:");
  console.log(result);

  const address = await wallet.createAddress("default");
  console.log("original address:");
  console.log(address);

})();