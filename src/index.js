const bcoin = require('bcoin').set('testnet');
const bcrypto = require('bcrypto');
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


const hour = 60 * 60;
const CSV_LOCKTIME = 1 * hour;
const secret = createSecret("foo");

const redeemScript = createRedeemScript(secret.hash, "publicKey1", "publicKey2", CSV_LOCKTIME);


function ensureBuffer(string) {
  if (Buffer.isBuffer(string))
    return string;
  else
    return new Buffer(string, 'hex');
}

function createSecret(secret) {
  if (!secret)
    secret = bcrypto.random.randomBytes(32);
  else
    secret = ensureBuffer(secret);

  const hash = bcrypto.SHA256.digest(secret);

  return {
    'secret': secret,
    'hash': hash
  };
}



function encodeCSV(locktime, seconds) {
  let locktimeUint32 = locktime >>> 0;
  if(locktimeUint32 !== locktime)
    throw new Error('Locktime must be a uint32.');

  if (seconds) {
    locktimeUint32 >>>= bcoin.consensus.SEQUENCE_GRANULARITY;
    locktimeUint32 &= bcoin.consensus.SEQUENCE_MASK;
    locktimeUint32 |= bcoin.consensus.SEQUENCE_TYPE_FLAG;
  } else {
    locktimeUint32 &= bcoin.consensus.SEQUENCE_MASK;
  }

  return locktimeUint32;
}

function createRedeemScript(hash, refundPubkey, swapPubkey, locktime) {
  const redeem = new bcoin.Script();
  locktime = encodeCSV(locktime, true);

  hash = ensureBuffer(hash);
  refundPubkey = ensureBuffer(refundPubkey);
  swapPubkey = ensureBuffer(swapPubkey);

  redeem.pushSym('OP_IF');
  redeem.pushSym('OP_SHA256');
  redeem.pushData(hash);
  redeem.pushSym('OP_EQUALVERIFY');
  redeem.pushData(swapPubkey);
  redeem.pushSym('OP_CHECKSIG');
  redeem.pushSym('OP_ELSE');
  redeem.pushInt(locktime);
  redeem.pushSym('OP_CHECKSEQUENCEVERIFY');
  redeem.pushSym('OP_DROP');
  redeem.pushData(refundPubkey);
  redeem.pushSym('OP_CHECKSIG');
  redeem.pushSym('OP_ENDIF');
  redeem.compile();

  return redeem;
}

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

  console.log("secret: ");
  console.log(secret.secret);

  console.log("secret hash: ");
  console.log(secret.hash);

  console.log("redeem script: ");
  console.log(redeemScript);

})();