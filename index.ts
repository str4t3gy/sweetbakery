
interface CompoundingResult {
    frequencyInDays: number;
    valueOfFirstCompound: number;
    finalAmount: number;
    realAPY: number;
}

/** Class used to calculate compound interests (i.e. CAKE->CAKE or BUNNY->BUNNY) */
class Compounder {
    public static simpleInterest(amount: number, interest: number): number {
        return amount + amount * interest / 100;
    }

    public static compoundInterest(amount: number, yearlyInterest: number, nrPeriods: number, fees: number, days: number = 365): number {
        const daysInEachPeriod = days / nrPeriods;
        const periodInterest = yearlyInterest / 365 * daysInEachPeriod;
        for (let i = 0; i < nrPeriods; i++) {
            amount = Compounder.simpleInterest(amount, periodInterest) - fees;
        }
        return amount;
    }

    public static calculateBestManualCompoundingInterval(amount: number, rate: number, fees: number): CompoundingResult {
        let finalAmount = Compounder.compoundInterest(amount, rate, 1, fees); // <- pure APR
        let bestNrPeriods = 1;
        while (true) {
            const nextResult = Compounder.compoundInterest(amount, rate, bestNrPeriods + 1, fees);
            if (nextResult <= finalAmount) {
                break;
            }
            bestNrPeriods++;
            finalAmount = nextResult;
        }
        const valueOfFirstCompound = Compounder.simpleInterest(amount, rate / bestNrPeriods) - amount;
        const frequencyInDays = 365 / bestNrPeriods;
        const realAPY = 100 * (finalAmount - amount) / amount;
        return { frequencyInDays, valueOfFirstCompound, finalAmount, realAPY };
    }
}

/** Class used to calculate compound interests in the CAKE pool of Pancakebunny */
class CAKEBUNNYCompounder {

    public static compoundEarningsForXDays(amount: number, aprCAKE: number, days: number, bnbPriceInUsd: number, bunnyPriceInUsd: number): [number, number] {
        const compoundAfterXDays = Compounder.compoundInterest(amount, aprCAKE, 365, 0, days);
        const earningsOnly = compoundAfterXDays - amount;
        const cake = earningsOnly * 0.7;
        const bunny = earningsOnly * 0.3 / bnbPriceInUsd * 5 * bunnyPriceInUsd;
        return [cake, bunny];
    }

    private static periodicallyCompoundBunnyAndCake(amount: number, nrPeriods: number, aprCAKE: number, aprBUNNY: number, feesCAKE: number, feesBUNNY: number, bnbPriceInUsd: number, bunnyPriceInUsd: number): number {
        const daysInEachPeriod = 365 / nrPeriods;
        let ownedCake = amount;
        let ownedBunny = 0;
        const bunnyPeriodInterest = aprBUNNY / 365 * daysInEachPeriod;

        for (let i = 0; i < nrPeriods; i++) {
            var cakeCompoundInterestForPeriod = this.compoundEarningsForXDays(ownedCake, aprCAKE, daysInEachPeriod, bnbPriceInUsd, bunnyPriceInUsd);
            var bunnySimpleInterestForPeriod = Compounder.simpleInterest(ownedBunny, bunnyPeriodInterest);

            ownedCake = ownedCake + cakeCompoundInterestForPeriod[0] - feesCAKE;
            ownedBunny = bunnySimpleInterestForPeriod + cakeCompoundInterestForPeriod[1] - feesBUNNY;
        }

        return ownedCake + ownedBunny;
    }

    public static calculateBestManualCompoundingInterval(amount: number, aprCAKE: number, aprBUNNY: number, feesCAKE: number, feesBUNNY: number, bnbPriceInUsd: number, bunnyPriceInUsd: number): CompoundingResult {
        let finalAmount = this.periodicallyCompoundBunnyAndCake(amount, 1, aprCAKE, aprBUNNY, feesCAKE, feesBUNNY, bnbPriceInUsd, bunnyPriceInUsd); // base: let CAKE compound 1 year
        let bestNrPeriods = 1;
        while (true && bestNrPeriods < 365) {
            const nextResult = this.periodicallyCompoundBunnyAndCake(amount, bestNrPeriods + 1, aprCAKE, aprBUNNY, feesCAKE, feesBUNNY, bnbPriceInUsd, bunnyPriceInUsd);
            if (nextResult <= finalAmount) {
                break;
            }
            bestNrPeriods++;
            finalAmount = nextResult;
        }

        var cakeCompoundInterestForFirstPeriod = this.compoundEarningsForXDays(amount, aprCAKE, 365 / bestNrPeriods, bnbPriceInUsd, bunnyPriceInUsd);            
        const valueOfFirstCompound = cakeCompoundInterestForFirstPeriod[0] + cakeCompoundInterestForFirstPeriod[1];
        const frequencyInDays = 365 / bestNrPeriods;
        const realAPY = 100 * (finalAmount - amount) / amount;
        return { frequencyInDays, valueOfFirstCompound, finalAmount, realAPY };
    }
}

/** Class used to calculate compound interests in the BUNNY-BNB pool of Pancakebunny */
class BUNNYBNBCompounder {

    private static periodicallyCompoundBunnyBNB(amount: number, nrPeriods: number, aprBUNNYBNB: number, aprBUNNY: number, feesBUNNYBNB: number, feesBunnyPool: number): number {
        const daysInEachPeriod = 365 / nrPeriods;
        const bunnyBnbPeriodInterest = aprBUNNYBNB / 365 * daysInEachPeriod;
        const bunnyPeriodInterest = aprBUNNY / 365 * daysInEachPeriod;
        let ownedBunny = 0;

        for (let i = 0; i < nrPeriods; i++) {
            var interestsForPeriod = Compounder.simpleInterest(amount, bunnyBnbPeriodInterest) - amount - feesBUNNYBNB;
            var bunnySimpleInterestForPeriod = Compounder.simpleInterest(ownedBunny, bunnyPeriodInterest) - feesBunnyPool;
            ownedBunny = bunnySimpleInterestForPeriod + interestsForPeriod;
        }

        return amount + ownedBunny;
    }

    public static calculateBestManualCompoundingInterval(amount: number, aprBUNNYBNB: number, aprBUNNY: number, feesBUNNYBNB: number, feesBunnyPool: number): CompoundingResult {
        let finalAmount = this.periodicallyCompoundBunnyBNB(amount, 1, aprBUNNYBNB, aprBUNNY, feesBUNNYBNB, feesBunnyPool); // base: let BUNNYBNB compound 1 year
        let bestNrPeriods = 1;
        while (true && bestNrPeriods < 365) {
            const nextResult = this.periodicallyCompoundBunnyBNB(amount, bestNrPeriods + 1, aprBUNNYBNB, aprBUNNY, feesBUNNYBNB, feesBunnyPool);
            if (nextResult <= finalAmount) {
                break;
            }
            bestNrPeriods++;
            finalAmount = nextResult;
        }

        const valueOfFirstCompound = Compounder.simpleInterest(amount, aprBUNNYBNB / bestNrPeriods) - amount;
        const frequencyInDays = 365 / bestNrPeriods;
        const realAPY = 100 * (finalAmount - amount) / amount;
        return { frequencyInDays, valueOfFirstCompound, finalAmount, realAPY };
    }
}

/** Part1:
 *
 * calculate how often you should manually compound your BUNNY pool to obtain the highest profit.
 *
*/

const amountUsdBunny = 266; // current USD amount in the BUNNY pool
const feesBunnyPool = 2.5; // claim+deposit BUNNY, converted to USD
const aprBunnyPool = 114.94; // current interest of BUNNY pool (APR, not APY)
var bestResultBunny = Compounder.calculateBestManualCompoundingInterval(amountUsdBunny, aprBunnyPool, feesBunnyPool);
console.log('###################################################################################################################')
console.log('################################### BUNNY COMPOUNDING #############################################################');
console.log('###################################################################################################################')
console.log('')
console.log(`The best interval to manually compound your investment is ${bestResultBunny.frequencyInDays} days`);
console.log(`Doing so, you should get to ${bestResultBunny.finalAmount} in 1 year.`);
console.log(`The real APY is: ${bestResultBunny.realAPY}%.`);
console.log(`The first time, wait until you have ${bestResultBunny.valueOfFirstCompound}\$ in unclaimed BUNNY`);
/** Part2:
 *
 * calculate how often you should manually compound your CAKE+BUNNY pool to obtain the highest profit.
 *
*/

const amountUsdCake = 266; // current USD amount in the BUNNY pool
const bunnyPrice = 430; // current price in USD of the BUNNY token
const bnbPrice = 560; // current price in USD of the BNB token
const feesCakePool = 7.5; // claim CAKE&BUNNY + deposit CAKE + deposit BUNNY, converted to USD
const aprBunnyPool_takenFromPancakeBUNNY = aprBunnyPool;  // current APR of BUNNY pool
const aprCakePool_takenFromPancakeSWAP = 92; // current interest of CAKE pool (The value in Pancakebunny is APY! You should get it from pancakeswap)
var bestResultCakeBunny = CAKEBUNNYCompounder.calculateBestManualCompoundingInterval(amountUsdCake, aprCakePool_takenFromPancakeSWAP, aprBunnyPool_takenFromPancakeBUNNY, feesCakePool, feesBunnyPool, bnbPrice, bunnyPrice);
console.log('')
console.log('###################################################################################################################')
console.log('###################################### CAKE COMPOUNDING ###########################################################')
console.log('###################################################################################################################')
console.log('')
console.log(`The best interval to manually compound your investment is ${bestResultCakeBunny.frequencyInDays} days`);
console.log(`Doing so, you should get to ${bestResultCakeBunny.finalAmount} in 1 year.`);
console.log(`The real APY is: ${bestResultCakeBunny.realAPY}%.`);
console.log(`The first time, wait until you have ${bestResultCakeBunny.valueOfFirstCompound}\$ in unclaimed CAKE+BUNNY`);
/** Part3:
 *
 * calculate how often you should manually compound your BUNNY-BNB pool to obtain the highest profit.
 *
*/

const amountUsdBunnyBnb = 266; // current USD amount in the BUNNY pool
const feesBunnyBnbAndBunnyPools = 7; // claim+deposit BUNNY, converted to USD
const aprBunnyBnbPool = 142; // current interest of BUNNY pool (APR, not APY)
var bestResultBunnyBnb = BUNNYBNBCompounder.calculateBestManualCompoundingInterval(amountUsdBunnyBnb,aprBunnyBnbPool, aprBunnyPool, feesBunnyBnbAndBunnyPools, feesBunnyPool);
console.log('')
console.log('###################################################################################################################')
console.log('#################################### BUNNY-BNB FLIP COMPOUNDING ###################################################')
console.log('###################################################################################################################')
console.log('')
console.log(`The best interval to manually compound your investment is ${bestResultBunnyBnb.frequencyInDays} days`);
console.log(`Doing so, you should get to ${bestResultBunnyBnb.finalAmount} in 1 year.`);
console.log(`The real APY is: ${bestResultBunnyBnb.realAPY}%.`);
console.log(`The first time, wait until you have ${bestResultBunnyBnb.valueOfFirstCompound}\$ in unclaimed BUNNY`);
console.log('')
console.log('###################################################################################################################')