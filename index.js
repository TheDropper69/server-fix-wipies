const { ethers } = require("ethers");
const Web3 = require("web3");
const ABI = require('./abi.json');
const express = require('express')
const app = express()

const privateKey = process.env.privateKey;
const provider = 'https://speedy-nodes-nyc.moralis.io/76b2f29afb9fc6b2be292ca2/polygon/mainnet';
const contractAddress = '0x8639cbd0acdd07dd4b9c1ee7d0f39b31d4ce32cf';
const creationAddress = '0xcb3bf46fe23e0caa8843160e6dae78c374624ddd';
const customHttpProvider = new ethers.providers.JsonRpcProvider(provider)
let wallet = new ethers.Wallet(privateKey)
let walletSigner = wallet.connect(customHttpProvider)
const contract = new ethers.Contract(contractAddress, ABI, walletSigner);

class Queue {
    constructor(maxSimultaneously = 1) {
        this.maxSimultaneously = maxSimultaneously;
        this.__active = 0;
        this.__queue = [];
    }

    /** @param { () => Promise<T> } func
     * @template T
     * @returns {Promise<T>}
     */
    async enqueue(func) {
        if(++this.__active > this.maxSimultaneously) {
            await new Promise(resolve => this.__queue.push(resolve));
        }

        try {
            return await func();
        } catch(err) {
            throw err;
        } finally {
            this.__active--;
            console.log('Queue length: ' + this.__queue.length)
            if(this.__queue.length) {
                this.__queue.shift()();
            }
        }
    }
}

const q = new Queue();

async function init() {
    const contractName = await contract.name()
    console.log('Connected to: ',contractName)

    let filter = contract.filters.Transfer('0x0000000000000000000000000000000000000000', null, null)

    contract.on(filter, (from, to, amount, event) => {
        const tokenId = Web3.utils.hexToNumber(event.topics[3]);
        console.log('Found new Transfer tokenId: ' + tokenId)
        getTrans(event, tokenId);
    });
}

async function getTrans(event, tokenId) {

    const transaction = await event.getTransaction();

    if(transaction) {
        const to = transaction.from;
        console.log('Found new Transfer to: ' + to)
        // q.enqueue(() => doTrans(to, tokenId));
        setTimeout(() => {
            return q.enqueue(() => doTrans(to, tokenId));
        }, 5000)
    } else {
        console.log('Corsponding Transaction not found')
    }
}

async function doTrans(to, tokenId) {

    await new Promise(res => setTimeout((res), 30000));

    console.log('Starting transfer ' + tokenId + ' to ' + to);

    const options = {
        gasPrice: 200000000000,
        gasLimit: 200000
    }

    const transfer = await contract.transferFrom(creationAddress, to, tokenId, options);

    if (transfer) {
        console.log('Transfer send: ' + transfer.hash)
        return true;
    }
}

// doTrans('0x5d137293c4a415c6cbf827319cedfc4eef6b0c6f', 118)

async function run() {
    try {
        await init()
    } catch (e) {
        console.error('Error in init', e)
        console.log('Restarting...')
        init()
    }
};


app.listen(process.env.PORT || 3001, '0.0.0.0', () => {
    console.log("Server is running.");
});

run();
