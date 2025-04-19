const User = require("../models/User");

async function getReferralBVTree(username) {
  const user = await User.findOne({ username }).populate(
    "package",
    "name price"
  );

  // console.log("User:", user); // Debugging line to check user details
  if (!user) {
    console.log(`User not found: ${username}`);
    return null;
  }

  const referrals = await User.find({ referredBy: username });

  const children = await Promise.all(
    referrals.map((ref) => getReferralBVTree(ref.username))
  );

  const childBVTotal = children.reduce(
    (sum, child) => sum + (child.bv || 0),
    0
  );
  const totalBV = user.bv + childBVTotal;

  return {
    username: user.username,
    bv: user.bv,
    package: user.package.name,
    // totalBV, // <-- This is the cumulative BV (self + downlines)
    referrals: children.filter(Boolean),
  };
}

module.exports = getReferralBVTree;
