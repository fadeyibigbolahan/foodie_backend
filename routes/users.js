const router = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const transporter = require("../utils/emailConfig");
const getReferralBVTree = require("../utils/getReferralBVTree");

// Bring in the User Registration function
const {
  serializeUser,
  checkRole,
  userRegister,
  userLogin,
  userAuth,
} = require("../utils/Auth");

/***************************************************************************************************
REGISTRATIONS => STARTS
 ***************************************************************************************************/
// Users Registeration Route
router.post("/register-user", async (req, res) => {
  await userRegister(req.body, "user", res);
});

// Admins Registeration Route
router.post("/register-admin", async (req, res) => {
  console.log("reqBody", req.body);
  await userRegister(req.body, "admin", res);
});

/***************************************************************************************************
REGISTRATIONS => ENDS
 ***************************************************************************************************/

/****************************************************************************************************
LOGIN => START
 ***************************************************************************************************/
// Users Login Route
router.post("/login-user", async (req, res) => {
  await userLogin(req.body, "user", res);
});

// Admin Login Route
router.post("/login-admin", async (req, res) => {
  await userLogin(req.body, "admin", res);
});
/****************************************************************************************************
LOGIN => ENDS
 ***************************************************************************************************/

/****************************************************************************************************
PROFILE => START
 ***************************************************************************************************/
router.get("/profile", userAuth, async (req, res) => {
  try {
    // Extract user ID from token (userAuth middleware should attach user to req)
    const user = await User.findById(req.user.id)
      .populate("package", "name price") // Populate package details
      .populate("referrals", "username email") // Populate referred users
      .select("-password"); // Exclude password from response

    if (!user) return res.status(404).json({ message: "User not found" });

    // console.log("user", user);

    res.status(200).json({
      name: user.name,
      username: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      package: user.package,
      earnings: user.earnings,
      totalEarnings: user.totalEarnings,
      bv: user.bv,
      totalWithdrawals: user.totalWithdrawals,
      monthlyBV: user.monthlyBV,
      referrals: user.referrals,
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

/****************************************************************************************************
PROFILE => ENDS
****************************************************************************************************/

/****************************************************************************************************
FORGET PASSWORD => START
****************************************************************************************************/
router.get("/forget-password/:email", async (req, res) => {
  try {
    // const email = req.body.email;
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }
    console.log("uss", user);

    const mailOptions = {
      from: emailAddress,
      to: user.email,
      subject: "ACCOUNT RESET CODE",
      text: `This is your password reset code ${user.verificationCode}`,
    };

    await transporter.sendMail(mailOptions);

    return res.json({
      data: user,
      message: "Password reset token sent",
      success: true,
    });
  } catch (err) {
    res.status(500).json({ data: err, message: err, success: false });
  }
});
/****************************************************************************************************
FORGET PASSWORD => ENDS
****************************************************************************************************/
/****************************************************************************************************
RESET PASSWORD => START
****************************************************************************************************/
router.put("/reset-password", async (req, res) => {
  try {
    const { username, newPassword } = req.body;

    if (!username || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Username and new password are required",
      });
    }

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;

    await user.save();

    res.json({
      success: true,
      message: "Password reset successful",
    });
  } catch (err) {
    console.error("Error resetting password:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/****************************************************************************************************
RESET PASSWORD => ENDS
****************************************************************************************************/

/****************************************************************************************************
GET ALL USERS => START
****************************************************************************************************/
// router.get("/all/users", userAuth, checkRole(["admin"]), async (req, res) => {
router.get("/all/users", userAuth, async (req, res) => {
  const user = await User.find({ role: "user" });
  try {
    var result = user.map((eachUser) => serializeUser(eachUser));
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json(err);
  }
});
/****************************************************************************************************
GET ALL USERS => ENDS
****************************************************************************************************/

/****************************************************************************************************
UPDATE USER => START
****************************************************************************************************/
router.put("/profile/update", userAuth, async (req, res) => {
  try {
    const { username, email, phoneNumber, password } = req.body;
    const userId = req.user._id; // Get user ID from token

    let user = await User.findById(userId);
    // console.log("user", user);
    console.log("phone", req.body);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Update fields if provided
    if (username) user.username = username;
    if (email) user.email = email;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();
    res.status(200).json({ message: "Profile updated successfully", user });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
/****************************************************************************************************
UPDATE USER => ENDS
****************************************************************************************************/

/****************************************************************************************************
 * GET REFERRAL BV TREE => START
 ****************************************************************************************************/
router.get("/bv-referral-tree/:username", userAuth, async (req, res) => {
  try {
    const username = req.params.username;

    const tree = await getReferralBVTree(username);
    console.log("tree", tree);

    res.status(200).json({
      message: "Referral BV Tree Structure",
      tree,
    });
  } catch (error) {
    console.error("Error generating tree:", error);
    res.status(500).json({ message: "Server error" });
  }
});
/****************************************************************************************************
 * GET REFERRAL BV TREE => ENDS
 ****************************************************************************************************/
module.exports = router;
