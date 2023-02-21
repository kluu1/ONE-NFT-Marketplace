const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('NFT Marketplace', function () {
  let NFTMarket;
  let nftMarket;
  let listingPrice;
  let contractOwner;
  let buyerAddress;
  let nftMarketAddress;
  const tokenURI = 'http://sometoken.uri';
  const auctionPrice = ethers.utils.parseUnits('100', 'ether');

  beforeEach(async () => {
    NFTMarket = await ethers.getContractFactory('NFTMarketplace');
    nftMarket = await NFTMarket.deploy();
    await nftMarket.deployed();
    nftMarketAddress = nftMarket.address;
    [contractOwner, buyerAddress] = await ethers.getSigners();
    listingPrice = await nftMarket.getListingPrice();
    listPrice = listingPrice.toString();
  });

  const mintAndListNFT = async (tokenURI, auctionPrice) => {
    const transaction = await nftMarket.createToken(tokenURI, auctionPrice, {
      value: listingPrice,
    });
    const receipt = await transaction.wait();
    const tokenId = receipt.events[0].args.tokenId;

    return tokenId;
  };

  describe('Mint and list a new NFT token', function () {
    it('Should revert if price is zero', async () => {
      await expect(mintAndListNFT(tokenURI, 0)).to.be.revertedWith(
        'price must be greater than 0'
      );
    });

    it('Should revert if listing price is not correct', async function () {
      await expect(
        nftMarket.createToken(tokenURI, auctionPrice, { value: 0 })
      ).to.be.revertedWith('price must be equal to listing price');
    });

    it('Should create a NFT with correct owner and tokenURI', async function () {
      const tokenId = await mintAndListNFT(tokenURI, auctionPrice);
      const mintedTokenURI = await nftMarket.tokenURI(tokenId);
      const ownerAddress = await nftMarket.ownerOf(tokenId);

      expect(ownerAddress).to.equal(nftMarketAddress);
      expect(mintedTokenURI).to.equal(tokenURI);
    });

    it('Should emit MarketItemCreated after succesfully listing of NFT', async function () {
      const transaction = await nftMarket.createToken(tokenURI, auctionPrice, {
        value: listingPrice,
      });
      const receipt = await transaction.wait();
      const tokenId = receipt.events[0].args.tokenId;

      await expect(transaction)
        .to.emit(nftMarket, 'MarketItemCreated')
        .withArgs(
          tokenId,
          contractOwner.address,
          nftMarketAddress,
          auctionPrice,
          false
        );
    });
  });

  describe('Execute sale ofa marketplace item', function () {
    it('Should revert if auction price is not correct', async () => {
      const newNftToken = await mintAndListNFT(tokenURI, auctionPrice);

      await expect(
        nftMarket
          .connect(buyerAddress)
          .createMarketSale(newNftToken, { value: 20 })
      ).to.be.revertedWith(
        'please submit the asking price in order to complete the purchase'
      );
    });

    it('Buy a new token and check token owner address', async () => {
      const newNftToken = await mintAndListNFT(tokenURI, auctionPrice);
      const oldOwnerAddress = await nftMarket.ownerOf(newNftToken);

      // check current owner is the marketplace address before the sale
      expect(oldOwnerAddress).to.equal(nftMarketAddress);

      // make the sale of item
      await nftMarket
        .connect(buyerAddress)
        .createMarketSale(newNftToken, { value: auctionPrice });

      // new owner is the buyer address
      const newOwnerAddress = await nftMarket.ownerOf(newNftToken);
      expect(newOwnerAddress).to.equal(buyerAddress.address);
    });
  });

  describe('Resell of a marketplace item', function () {
    it('Should revert if token owner or listing price is not correct', async () => {
      const newNftToken = await mintAndListNFT(tokenURI, auctionPrice);
      await nftMarket
        .connect(buyerAddress)
        .createMarketSale(newNftToken, { value: auctionPrice });

      await expect(
        nftMarket.resellToken(newNftToken, auctionPrice, {
          value: listingPrice,
        })
      ).to.be.revertedWith('only item owner can perform this operation');
      await expect(
        nftMarket
          .connect(buyerAddress)
          .resellToken(newNftToken, auctionPrice, { value: 0 })
      ).to.be.revertedWith('price must be equal to listing price');
    });

    it('Should buy a new token and then reselling', async () => {
      // Buy: New owner should be buyer address
      const newNftToken = await mintAndListNFT(tokenURI, auctionPrice);
      await nftMarket
        .connect(buyerAddress)
        .createMarketSale(newNftToken, { value: auctionPrice });

      const tokenOwnerAddress = await nftMarket.ownerOf(newNftToken);
      expect(tokenOwnerAddress).to.equal(buyerAddress.address);

      // Resell: New owner should be the market place address
      await nftMarket
        .connect(buyerAddress)
        .resellToken(newNftToken, auctionPrice, { value: listingPrice });

      const newTokenOwner = await nftMarket.ownerOf(newNftToken);
      expect(newTokenOwner).to.equal(nftMarketAddress);
    });
  });

  describe('Fetch marketplace items', function () {
    it('Should fetch the correct number of unsold items', async () => {
      await mintAndListNFT(tokenURI, auctionPrice);
      await mintAndListNFT(tokenURI, auctionPrice);
      await mintAndListNFT(tokenURI, auctionPrice);

      const unsoldItems = await nftMarket.fetchMarketItems();
      expect(unsoldItems.length).is.equal(3);
    });

    it('Should fetch correct number of items that a user has purchased', async () => {
      const nftToken = await mintAndListNFT(tokenURI, auctionPrice);
      await mintAndListNFT(tokenURI, auctionPrice);
      await mintAndListNFT(tokenURI, auctionPrice);
      await nftMarket
        .connect(buyerAddress)
        .createMarketSale(nftToken, { value: auctionPrice });

      const buyerTotalItems = await nftMarket
        .connect(buyerAddress)
        .fetchPurchasedNFTs();
      expect(buyerTotalItems.length).is.equal(1);
    });

    it('Should fetch correct number of items listed by a user', async () => {
      await mintAndListNFT(tokenURI, auctionPrice);
      await mintAndListNFT(tokenURI, auctionPrice);
      await nftMarket
        .connect(buyerAddress)
        .createToken(tokenURI, auctionPrice, { value: listingPrice });

      const ownersListing = await nftMarket.fetchItemsListed();
      expect(ownersListing.length).to.equal(2);
    });
  });

  describe('Cancel a marketplace listing', () => {
    it('Should cancel and return the correct number of listings', async () => {
      const nftToken = await mintAndListNFT(tokenURI, auctionPrice);
      await nftMarket
        .connect(buyerAddress)
        .createToken(tokenURI, auctionPrice, { value: listingPrice });
      await nftMarket
        .connect(buyerAddress)
        .createToken(tokenURI, auctionPrice, { value: listingPrice });

      const unsoldItems = await nftMarket.fetchMarketItems();
      expect(unsoldItems.length).is.equal(3);

      await nftMarket.cancelItemListing(nftToken);
      const newUnsoldItems = await nftMarket.fetchMarketItems();
      expect(newUnsoldItems.length).is.equal(2);
    });
  });
});
