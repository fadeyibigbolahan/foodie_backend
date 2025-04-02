const User = require("../models/User");

async function checkIncentiveQualification(username) {
  try {
    // Find the user
    const user = await User.findOne({ username }).populate("referrals");
    if (!user) return { qualified: false, message: "User not found" };

    // Get BV values from referrals
    let downlineBV = user.referrals.map((ref) => ref.bv);

    // If fewer than 3 downlines, they don’t qualify
    if (downlineBV.length < 3) {
      return {
        qualified: false,
        message: "Not enough downlines (minimum 3 required)",
      };
    }

    // Sort BV from highest to lowest
    downlineBV.sort((a, b) => b - a);
    const totalBV = downlineBV.reduce((sum, bv) => sum + bv, 0);

    // Get the highest, second highest, and lowest leg contributions
    const highestLeg = downlineBV[0];
    const secondHighestLeg = downlineBV[1];
    const lowestLeg = downlineBV[2];

    // Calculate percentages
    const highestPercentage = (highestLeg / totalBV) * 100;
    const secondHighestPercentage = (secondHighestLeg / totalBV) * 100;
    const lowestPercentage = (lowestLeg / totalBV) * 100;

    // Check the 40:40:20 rule conditions
    if (highestPercentage > 40) {
      return { qualified: false, message: "One leg contributes more than 40%" };
    }
    if (secondHighestPercentage > 40) {
      return {
        qualified: false,
        message: "Second leg contributes more than 40%",
      };
    }
    if (lowestPercentage < 20) {
      return {
        qualified: false,
        message: "Lowest leg must contribute at least 20%",
      };
    }

    return { qualified: true, message: "User qualifies for incentives!" };
  } catch (error) {
    console.error(error);
    return { qualified: false, message: "Server error" };
  }
}

module.exports = checkIncentiveQualification;
