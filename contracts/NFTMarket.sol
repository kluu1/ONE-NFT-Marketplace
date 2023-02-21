// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract NFTMarketplace is ERC721URIStorage {
  using Counters for Counters.Counter;
  Counters.Counter private _tokenIds; // total of number ever created
  Counters.Counter private _itemsSold; // total number of items sold

  uint256 listingPrice = 0.001 ether; // people hav to pay to list their nft
  address payable owner; // owner of the smart contract

  constructor() ERC721("Metaverse Tokens", "META") {
    owner = payable(msg.sender);
  }

  mapping (uint256 => MarketItem) private idToMarketItem;

  struct MarketItem {
    uint256 tokenId;
    address payable seller;
    address payable owner;
    uint256 price;
    bool sold;
  }

  event MarketItemCreated (
    uint256 indexed tokenId,
    address seller,
    address owner,
    uint256 price,
    bool sold
  );

  // returns listing price of the market
  function getListingPrice() public view returns(uint256) {
    return listingPrice;
  }

  // update the listing price
  function updateListingPrice(uint256 _listingPrice) public payable {
    require(owner == msg.sender, "only marketplace owner can update listing price");
    listingPrice = _listingPrice;
  } 

  function createMarketItem(uint256 tokenId, uint256 price) private {
    require(price > 0, "price must be greater than 0");
    require(msg.value == listingPrice, "price must be equal to listing price");

    idToMarketItem[tokenId] = MarketItem(
      tokenId,
      payable(msg.sender),
      payable(address(this)),
      price,
      false
    );

    _transfer(msg.sender, address(this), tokenId);
    emit MarketItemCreated(tokenId, msg.sender, address(this), price, false);
  }

  // mints a token and list it in the marketplace
  function createToken(string memory tokenURI, uint256 price) public payable returns (uint) {
    _tokenIds.increment();
    uint256 newTokenId = _tokenIds.current();
    _mint(msg.sender, newTokenId);
    _setTokenURI(newTokenId, tokenURI);
    createMarketItem(newTokenId, price);
    return newTokenId;
  }

  // creating the sale of a marketplace item (transfer ownership of item as well as funds between parties)
  function createMarketSale(uint256 tokenId) public payable {
    uint price = idToMarketItem[tokenId].price;
    address seller = idToMarketItem[tokenId].seller;

    require(msg.value == price, "please submit the asking price in order to complete the purchase");
    idToMarketItem[tokenId].owner = payable(msg.sender);
    idToMarketItem[tokenId].sold = true;
    idToMarketItem[tokenId].seller = payable(address(0));
    _itemsSold.increment();
    _transfer(address(this), msg.sender, tokenId);
    payable(owner).transfer(listingPrice);
    payable(seller).transfer(msg.value);
  }

  // returns all unsold market items
  function fetchMarketItems() public view returns(MarketItem[] memory) {
    uint itemCount = _tokenIds.current();
    uint unsoldItemCount = _tokenIds.current() - _itemsSold.current();
    uint currentIndex = 0;

    MarketItem[] memory items = new MarketItem[](unsoldItemCount);

    for (uint i = 0; i < itemCount; i++) {
      if (idToMarketItem[i + 1].owner == address(this)) {
        uint currentId = i + 1;
        MarketItem storage currentItem = idToMarketItem[currentId];
        items[currentIndex] = currentItem;
        currentIndex += 1;
      }
    }
    return items;
  }

  // fetch items purchased by a user
  function fetchPurchasedNFTs() public view returns(MarketItem[] memory) {
    uint totalItemCount = _tokenIds.current();
    uint itemCount = 0;
    uint currentIndex = 0;

    for (uint i = 0; i < totalItemCount; i++) {
      if (idToMarketItem[i + 1].owner == msg.sender) {
        itemCount += 1;
      }
    }

    MarketItem[] memory items = new MarketItem[](itemCount);
    for (uint i = 0; i < totalItemCount; i++) {
      if (idToMarketItem[i + 1].owner == msg.sender) {
        uint currentId = i + 1;
        MarketItem storage currentItem =  idToMarketItem[currentId];
        items[currentIndex] = currentItem;
        currentIndex += 1;
      }
    }
    return items;
  }

  // fetch items listed by the user
  function fetchItemsListed() public view returns(MarketItem[] memory) {
    uint totalItemCount = _tokenIds.current();
    uint itemCount = 0;
    uint currentIndex = 0;

    for (uint i = 0; i < totalItemCount; i++) {
      if (idToMarketItem[i + 1].seller == msg.sender) {
        itemCount += 1;
      }
    }

    MarketItem[] memory items = new MarketItem[](itemCount);
    for (uint i = 0; i < totalItemCount; i++) {
      if (idToMarketItem[i + 1].owner == msg.sender) {
        uint currentId = i + 1;
        MarketItem storage currentItem =  idToMarketItem[currentId];
        items[currentIndex] = currentItem;
        currentIndex += 1;
      }
    }
    return items;
  }

  // allow users to resell a token they have purchased
  function resellToken(uint256 tokenId, uint256 price) public payable {
    require(idToMarketItem[tokenId].owner == msg.sender, "only item owner can perform this operation");
    require(msg.value == listingPrice, "price must be equal to listing price");

    idToMarketItem[tokenId].sold = false;
    idToMarketItem[tokenId].price = price;
    idToMarketItem[tokenId].seller = payable(msg.sender);
    idToMarketItem[tokenId].owner = payable(address(this));

    _itemsSold.decrement();
    _transfer(msg.sender, address(this), tokenId);
  }

  // allow user to cancel their market listing
  function cancelItemListing(uint256 tokenId) public {
    require(idToMarketItem[tokenId].seller == msg.sender, "only item seller can perform this operation");
    require(idToMarketItem[tokenId].sold == false, "item has bee sold, cannot cancel market listing");
    idToMarketItem[tokenId].owner = payable(msg.sender);
    idToMarketItem[tokenId].seller = payable(address(0));
    idToMarketItem[tokenId].sold = true;
    _itemsSold.increment();
    payable(owner).transfer(listingPrice);
    _transfer(address(this), msg.sender, tokenId);
  }
}