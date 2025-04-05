const User = require("../models/User");
const Transaction = require("../models/Transaction");
const createNotification = require("./createNotification");

async function distributeCommission(
  username,
  isUpgrade = false,
  previousPackage = null
) {
  try {
    // Define the commission structure for each level
    const COMMISSION_STRUCTURE = [
      { level: 1, percentage: 20 },
      { level: 2, percentage: 10 },
      { level: 3, percentage: 5 },
      { level: 4, percentage: 1.5 },
      { level: 5, percentage: 1 },
      { level: 6, percentage: 0.5 },
    ];

    let user = await User.findOne({ username }).populate("package");
    if (!user || !user.referredBy) {
      console.log(`No user or no referrer for ${username}`);
      return;
    }

    if (!user.package) {
      console.log(`User package is not populated for ${username}`);
      return;
    }

    // Package details for the user registering
    const packagePrice = user.package.price;
    const packageBV = user.package.bv;
    console.log(
      `Distributing commission for ${username} with package price: ${packagePrice}, BV: ${packageBV}`
    );

    let referrerUsername = user.referredBy;
    let level = 1;
    let totalDistributed = 0;
    let totalBVDistributed = 0;
    let lastValidReferrer = null;

    // If this is an upgrade, calculate the difference in price and BV
    let priceDifference = 0;
    let bvDifference = 0;
    let welcomeBonus = 0;

    if (isUpgrade && previousPackage) {
      priceDifference = packagePrice - previousPackage.price;
      bvDifference = packageBV - previousPackage.bv;

      // 20% welcome bonus of the difference in price
      welcomeBonus = (priceDifference * 20) / 100;
    }

    // Loop through up to 6 levels (the maximum levels for commission distribution)
    while (referrerUsername && level <= COMMISSION_STRUCTURE.length) {
      const commissionConfig = COMMISSION_STRUCTURE.find(
        (l) => l.level === level
      );
      const percentage = commissionConfig?.percentage || 0;

      let referrer = await User.findOne({
        username: referrerUsername,
      }).populate("package");

      if (!referrer) break; // Stop if there is no referrer at any point

      lastValidReferrer = referrer;

      // Calculate commission based on package price and commission percentage
      let commissionAmount = (packagePrice * percentage) / 100;

      // Handle upgrade logic (only the commission is affected, not BV)
      if (isUpgrade && previousPackage) {
        let prevCommissionAmount =
          (previousPackage.price * commissionConfig.percentage) / 100;

        commissionAmount += welcomeBonus; // Add welcome bonus to the commission

        // Adjust BV (fixed for each upline)
        referrer.bv += bvDifference;

        // Log the upgrade commission if applicable
        if (commissionAmount <= 0) {
          referrer = await User.findOne({
            username: referrer.referredBy,
          }).populate("package");
          level++;
          continue;
        }
      }

      // Distribute the commission and the BV (fixed for each upline)
      totalDistributed += percentage;
      totalBVDistributed += packageBV; // Add fixed BV for each level
      console.log(`totalBVDistributed: ${totalBVDistributed}`);
      console.log(`totalDistributed: ${totalDistributed}`);

      referrer.earnings += commissionAmount;
      referrer.totalEarnings += commissionAmount;
      referrer.bv += packageBV; // Add BV to the referrer
      referrer.monthlyBV += packageBV; // Add BV to monthly BV
      console.log(
        `Referrer ${referrer.username} earnings: ${referrer.earnings}`
      );

      // Save the referrer with the updated earnings and BV
      await referrer.save();

      // Log the commission transaction
      await Transaction.create({
        user: referrer._id,
        type: isUpgrade ? "upgrade-commission" : "commission",
        amount: commissionAmount,
        balanceAfter: referrer.earnings,
        details: isUpgrade
          ? `Additional commission from ${user.username}'s upgrade`
          : `Commission from referring ${user.username}`,
      });

      // Send a notification to the referrer
      await createNotification(
        referrer._id,
        `You earned ₦${commissionAmount.toFixed(2)} from ${user.username}.`
      );

      // Move to the next upline
      referrerUsername = referrer.referredBy;
      level++;
    }

    // If total commission is less than 100%, distribute the remaining commission to the last valid referrer
    if (lastValidReferrer && totalDistributed < 100) {
      const remainingPercentage = 100 - totalDistributed;
      const remainingAmount = (packagePrice * remainingPercentage) / 100;

      lastValidReferrer.earnings += remainingAmount;
      lastValidReferrer.totalEarnings += remainingAmount;
      await lastValidReferrer.save();

      await Transaction.create({
        user: lastValidReferrer._id,
        type: "extra-commission",
        amount: remainingAmount,
        balanceAfter: lastValidReferrer.earnings,
        details: `Extra commission due to incomplete upline structure from ${user.username}`,
      });

      await createNotification(
        lastValidReferrer._id,
        `You received ₦${remainingAmount.toFixed(2)} extra commission from ${
          user.username
        }.`
      );
    }
  } catch (err) {
    console.error("Error in distributing commission:", err);
    throw new Error("Error distributing commission.");
  }
}

module.exports = distributeCommission;
