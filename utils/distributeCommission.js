const User = require("../models/User");
const Transaction = require("../models/Transaction");
const createNotification = require("./createNotification");

async function distributeCommission(
  username,
  isUpgrade = false,
  previousPackage = null
) {
  try {
    let user = await User.findOne({ username }).populate("package");
    if (!user || !user.referredBy) {
      console.log(`No user or no referrer for ${username}`);
      return;
    }

    if (!user.package) {
      console.log(`User package is not populated for ${username}`);
      return;
    }

    let referrer = await User.findOne({ username: user.referredBy }).populate(
      "package"
    );

    if (!referrer || !referrer.package || !referrer.package.commissionLevels) {
      console.log(
        `Referrer or commissionLevels are missing for ${
          referrer ? referrer.username : "unknown referrer"
        }`
      );
      return;
    }

    let level = 1;

    while (referrer && level <= referrer.package.commissionLevels.length) {
      const commissionData = referrer.package.commissionLevels.find(
        (l) => l.level === level
      );

      if (commissionData) {
        let commissionAmount =
          (user.package.price * commissionData.percentage) / 100;
        let bvAmount = user.package.bv;

        // If this is an upgrade, calculate the additional commission from the upgrade difference
        if (isUpgrade && previousPackage) {
          let prevCommissionAmount =
            (previousPackage.price * commissionData.percentage) / 100;
          let prevBVAmount = previousPackage.bv;

          commissionAmount -= prevCommissionAmount;
          bvAmount -= prevBVAmount;

          // If no additional commission, skip this level
          if (commissionAmount <= 0) {
            referrer = await User.findOne({
              username: referrer.referredBy,
            }).populate("package");
            level++;
            continue; // Skip if no commission is to be given
          }
        }

        // Apply commission and BV updates
        referrer.earnings += commissionAmount;
        referrer.bv += bvAmount;
        referrer.totalEarnings += commissionAmount;
        referrer.monthlyBV += bvAmount;

        await referrer.save();

        // Log commission transaction
        await Transaction.create({
          user: referrer._id,
          type: isUpgrade ? "upgrade-commission" : "commission",
          amount: commissionAmount,
          balanceAfter: referrer.earnings,
          details: isUpgrade
            ? `Additional commission from ${user.username}'s package upgrade`
            : `Commission from referring ${user.username}`,
        });

        // Send notification
        await createNotification(
          referrer._id,
          `You earned ${commissionAmount} as commission from ${user.username}.`
        );
      }

      // Move up the referral hierarchy and ensure the package is populated for each new referrer
      referrer = await User.findOne({ username: referrer.referredBy }).populate(
        "package"
      );
      level++;

      if (!referrer) {
        console.log(`No more referrer found at level ${level}`);
        break;
      }
    }
  } catch (err) {
    console.error("Error in distributing commission:", err);
    throw new Error("Error distributing commission.");
  }
}

module.exports = distributeCommission;
