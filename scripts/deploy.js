const { ethers } = require('hardhat');

const main = async () => {
  const contractFactory = await ethers.getContractFactory('NFTMarketplace');
  const contract = await contractFactory.deploy();
  await contract.deployed();
  console.log('Contract deployed to :', contract.address);
  // save the address to the frontend
};

const runMain = async () => {
  try {
    await main();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

runMain();
