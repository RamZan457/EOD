module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",     // Localhost (default: ganache-cli)
      port: 8545,            // Standard Ethereum port (default: ganache-cli)
      network_id: "*",       // Any network (default: ganache-cli)
      gas: 5500000,          // Gas sent with each transaction (default: 6721975)
      gasPrice: 20000000000, // 20 gwei (in wei) (default: 100 gwei)
    },
  },
  compilers: {
    solc: {
      version: "0.8.21",   // Fetch exact version from solc-bin (default: truffle's version)
    },
  },
};
