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

    const TOTAL_COMMISSION_PERCENTAGE = COMMISSION_STRUCTURE.reduce(
      (sum, l) => sum + l.percentage,
      0
    );

    // Find the user and populate package details
    let user = await User.findOne({ username }).populate("package");
    if (!user || !user.referredBy) {
      console.log(`No user or no referrer for ${username}`);
      return;
    }

    if (!user.package) {
      console.log(`User package is not populated for ${username}`);
      return;
    }

    const packagePrice = user.package.price;
    const packageBV = user.package.bv;
    console.log(
      `Distributing commission for ${username} with package price: ${packagePrice}, BV: ${packageBV}`
    );

    // Handle upgrade scenario
    let priceDifference = 0;
    let bvDifference = 0;
    let welcomeBonus = 0;

    if (isUpgrade && previousPackage) {
      // Validate previousPackage
      if (!previousPackage || !previousPackage.price || !previousPackage.bv) {
        console.log("Invalid previousPackage data.");
        return;
      }
      priceDifference = packagePrice - previousPackage.price;
      bvDifference = packageBV - previousPackage.bv;
      welcomeBonus = (priceDifference * 20) / 100;
    }

    let referrerUsername = user.referredBy;
    let level = 1;
    let totalDistributed = 0;
    let totalBVDistributed = 0;
    let lastValidReferrer = null;

    // Process commission distribution for referrers
    while (referrerUsername && level <= COMMISSION_STRUCTURE.length) {
      const commissionConfig = COMMISSION_STRUCTURE.find(
        (l) => l.level === level
      );
      const percentage = commissionConfig?.percentage || 0;

      let referrer = await User.findOne({
        username: referrerUsername,
      }).populate("package");

      if (!referrer) break; // If no referrer found, break the loop

      lastValidReferrer = referrer;

      let commissionAmount = (packagePrice * percentage) / 100;

      // If it's an upgrade, adjust the commission logic
      if (isUpgrade && previousPackage) {
        let prevCommissionAmount = (previousPackage.price * percentage) / 100;

        commissionAmount =
          commissionAmount - prevCommissionAmount + welcomeBonus;

        // Adjust BV for referrer if it's an upgrade
        referrer.bv += bvDifference;

        // If commission amount is zero or less, skip the level
        if (commissionAmount <= 0) {
          referrerUsername = referrer.referredBy;
          level++;
          continue;
        }
      }

      totalDistributed += percentage;
      totalBVDistributed += packageBV;

      // Update referrer earnings
      referrer.earnings += commissionAmount;
      referrer.totalEarnings += commissionAmount;
      referrer.bv += packageBV;
      referrer.monthlyBV += packageBV;

      // Save referrer data and create transaction and notification
      await referrer.save();

      await Transaction.create({
        user: referrer._id,
        type: isUpgrade ? "upgrade-commission" : "commission",
        amount: commissionAmount,
        balanceAfter: referrer.earnings,
        details: isUpgrade
          ? `Additional commission from ${user.username}'s upgrade`
          : `Commission from referring ${user.username}`,
      });

      await createNotification(
        referrer._id,
        `You earned ₦${commissionAmount.toFixed(2)} from ${user.username}.`
      );

      referrerUsername = referrer.referredBy;
      level++;
    }

    // Handle remaining commission logic if there is any unassigned commission
    if (lastValidReferrer && totalDistributed < TOTAL_COMMISSION_PERCENTAGE) {
      const remainingPercentage =
        TOTAL_COMMISSION_PERCENTAGE - totalDistributed;
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
