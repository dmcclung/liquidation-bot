import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { getAvaxPrice } from "./getAvaxPrice";

export const calculateProfit = async (
  gasUsed: BigNumber,
  effectiveGasPrice: BigNumber,
  balanceDifference: BigNumber
): Promise<BigNumber> => {
  const transactionFee = gasUsed.mul(effectiveGasPrice);

  const avaxPrice = await getAvaxPrice();

  const transactionFeeUSD = transactionFee
    .mul(avaxPrice)
    .div(BigNumber.from(10).pow(18));
  console.log(
    "Transaction fee USD",
    ethers.utils.formatUnits(transactionFeeUSD)
  );

  const balanceDeltaUSD = balanceDifference
    .mul(avaxPrice)
    .div(BigNumber.from(10).pow(18));

  return balanceDeltaUSD;
};
