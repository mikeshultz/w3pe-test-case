const Web3 = require('web3')
const { generate } = require('ethereumjs-wallet')
const ZeroClientProvider = require('web3-provider-engine/zero')
const WalletSubprovider = require('ethereumjs-wallet/provider-engine')
const ganache = require("ganache-core")

const GANACHE_PORT = 8545

function generateWallerProvider(wallet) {
  return new WalletSubprovider(wallet)
}

function getEngineProvider(walletProv) {
  return new ZeroClientProvider({
    rpcUrl: `http://localhost:${GANACHE_PORT}/`,
    ...walletProv,
    engineParams: {
      useSkipCache: false
    }
  })
}

function getAccountsAsync(engineProvider) {
  return new Promise((resolve, reject) => {
    engineProvider.sendAsync({ method: 'eth_accounts', params: [] }, (error, response) => {
      if (error) {
        reject(error)
      } else {
        resolve(response)
      }
    })
  })
}

async function run() {
  const wallet = generate()
  const walletProv = generateWallerProvider(wallet)
  const engineProvider = getEngineProvider(walletProv)
  const web3Wallet = new Web3(engineProvider)
  const web3 = new Web3(`http://localhost:${GANACHE_PORT}/`)

  const netId = await web3.eth.net.getId()
  if (netId !== 999) throw new Error(`Invalid network, expected 999, got ${netId}`)

  const nodeAccounts = await web3.eth.getAccounts()
  const primary = nodeAccounts[0]
  const primaryBalance = await web3.eth.getBalance(primary)
  const walletAddress = wallet.getChecksumAddressString()
  const walletBalance = await web3.eth.getBalance(walletAddress)

  console.log('\nInitial Balances')
  console.log('================')
  console.log(`${primary}: ${web3.utils.fromWei(primaryBalance, 'ether')} ether`)
  console.log(`${walletAddress}: ${web3.utils.fromWei(walletBalance, 'ether')} ether`)
  console.log('================\n')

  if (primaryBalance === '0') throw new Error('Primary node account is not funded')

  // Fund our new wallet
  console.log(`Funding our new wallet at ${walletAddress}`)
  const receipt = await web3.eth.sendTransaction({
    from: primary,
    to: walletAddress,
    value: web3.utils.toWei('1', 'ether'),
    gas: '21000'
  })
  if (!receipt.status) throw new Error('tx failed')

  console.log('Sending funds from our new wallet...')
  const receipt2 = await web3Wallet.eth.sendTransaction({
    from: walletAddress,
    to: primary,
    value: '1',
    gas: '21000'
  })
  if (!receipt2.status) throw new Error('tx failed')

  const primaryBalanceFinal = await web3.eth.getBalance(primary)
  const walletBalanceFinal = await web3.eth.getBalance(walletAddress)

  console.log('\nFinal Balances')
  console.log('================')
  console.log(`${primary}: ${web3.utils.fromWei(primaryBalanceFinal, 'ether')} ether`)
  console.log(`${walletAddress}: ${web3.utils.fromWei(walletBalanceFinal, 'ether')} ether`)
  console.log('================\n')

  // Try the user's test
  console.log('Trying sendAsync...')
  const res = await getAccountsAsync(engineProvider)
  console.log('wallet account: ', res.result[0])
}
function main() {
  const server = ganache.server({
    default_balance_ether: 15,
    total_accounts: 3,
    network_id: 999,
    locked: false
  })
  
  server.listen(GANACHE_PORT, (err) => {
    if (err) console.error(err)
  })

  console.log('Starting test...')
  run().then(() => {
    console.log('complete')
    process.exit(0)
  }).catch(err => {
    console.error(err)
    process.exit(1)
  })
}

if (require.main === module) {
  main()
}
