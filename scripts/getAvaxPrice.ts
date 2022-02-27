import { ethers } from "hardhat";
import oracleAbi from "../external/PriceOracle.json";

import { oracle, javax } from "./addresses";

export const getAvaxPrice = async () => {
  const priceOracle = await ethers.getContractAt(oracleAbi, oracle);
  const price = await priceOracle.getUnderlyingPrice(javax);
  return price;
};
