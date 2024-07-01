const express = require('express');
const Web3 = require('web3');
const cors = require('cors');
const teacherRoutes = require('./routes/teachers');
const contractABI = require('./build/contracts/LMS.json').abi;
const contractAddress = process.env.CONTRACTADDRESS;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Connect to Ganache
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.GANACHE_URI));

// Middleware to parse JSON
app.use(express.json());

// Set up the contract instance
const contract = new web3.eth.Contract(contractABI, contractAddress);

// Middleware to attach contract to req
app.use((req, res, next) => {
    req.contract = contract;
    req.web3 = web3;
    next();
});

// Routes
app.use('/teachers', teacherRoutes);

// Endpoint to get accounts
app.get('/accounts', async (req, res) => {
    try {
        const accounts = await web3.eth.getAccounts();
        res.json(accounts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get account balance
app.get('/balance/:account', async (req, res) => {
    const { account } = req.params;
    try {
        const balance = await web3.eth.getBalance(account);
        res.json({ account, balance: web3.utils.fromWei(balance, 'ether') });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to send a transaction
app.post('/sendTransaction', async (req, res) => {
    const { from, to, value } = req.body;
    try {
        const receipt = await web3.eth.sendTransaction({
            from,
            to,
            value: web3.utils.toWei(value, 'ether'),
        });
        res.json(receipt);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = app;
