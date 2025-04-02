const User = require("../models/User");
const PackageCode = require("../models/PackageCode");
const Package = require("../models/Package");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const { SECRET, emailAddress } = require("../config");
const { registerValidation, loginValidation } = require("../utils/validation");
const transporter = require("./emailConfig");
const Notification = require("../models/Notification");
const Transaction = require("../models/Transaction");
const distributeCommission = require("./distributeCommission");

/****************************************************************************************************
REGISTRATION AUTHENTICATION => STARTS
 ***************************************************************************************************/
/**
 * @DESC To register the user (ADMIN, USER)
 */

const userRegister = async (userDets, role, res) => {
  try {
    // Validate the username
    let usernameNotTaken = await validateUsername(userDets.username);
    if (!usernameNotTaken) {
      return res.status(400).json({
        message: `Username is already taken.`,
        success: false,
      });
    }

    // Validate the email
    let emailNotRegistered = await validateEmail(userDets.email);
    if (!emailNotRegistered) {
      return res.status(400).json({
        message: `Email is already taken.`,
        success: false,
      });
    }

    // Check if package code exists and is unused
    const code = await PackageCode.findOne({
      code: userDets.packageCode,
      assignedTo: null,
    }).populate("package");
    if (!code) {
      console.log("Invalid or used package code:", userDets.packageCode);
      return res.status(400).json({ message: "Invalid or used package code" });
    }

    // Get the hashed password
    const password = await bcrypt.hash(userDets.password, 12);

    let referredBy = null;
    let referrer = null;

    if (userDets.referredBy) {
      referrer = await User.findOne({ username: userDets.referredBy });
      if (!referrer)
        return res.status(400).json({ message: "Invalid referrer username" });
      referredBy = referrer.username;
    }

    // create a new user
    const newUser = new User({
      ...userDets,
      referredBy: referredBy || "superadmin",
      package: code.package._id,
      bv: code.package.bv, // Award BV from the package
      password,
      role,
    });

    let bonusAmount = (code.package.price * 20) / 100;
    newUser.earnings += bonusAmount;
    newUser.totalEarnings += bonusAmount;
    newUser.monthlyBV += code.package.bv; // Add monthly BV from the package

    const savedUser = await newUser.save();
    if (!savedUser) {
      console.log("User saving failed:", newUser.username);
      return res.status(500).json({
        message: "Error saving user to the database. Try again later.",
        success: false,
      });
    }

    // Log bonus transaction
    const transaction = await Transaction.create({
      user: newUser._id,
      type: "bonus",
      amount: bonusAmount,
      balanceAfter: newUser.earnings,
      details: "Registration bonus",
    });
    if (!transaction) {
      console.log("Transaction logging failed:", bonusAmount);
      return res.status(500).json({
        message: "Error logging transaction. Try again later.",
        success: false,
      });
    }

    // If referred, update referrer's referral list
    if (referrer) {
      referrer.referrals.push(newUser.username);
      await referrer.save();
    }

    // Mark the package code as used
    code.assignedTo = newUser._id;
    await code.save();

    // Distribute BV and commission
    console.log("Distributing commission for user:", newUser.username);
    try {
      await distributeCommission(newUser.username);
    } catch (err) {
      console.error("Error distributing commission:", err);
      return res.status(500).json({
        message: "Error distributing commission. Try again later.",
        success: false,
      });
    }

    console.log("distribution commission check, passed here");

    let token;
    if (savedUser) {
      //Sign in the token and issue it to the user
      console.log("trying to create token");
      token = jwt.sign(
        {
          _id: savedUser._id,
          role: savedUser.role,
          email: savedUser.email,
        },
        SECRET,
        { expiresIn: "7 days" }
      );
    }

    let result = {
      role: savedUser.role,
      _id: savedUser._id,
      email: savedUser.email,
      token: `Bearer ${token}`,
      expiresIn: 168,
    };

    return res.status(201).json({
      ...result,
      message: "Hurry! now you have successfully registered. Please now login.",
      success: true,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Unable to create your account, try again later.",
      success: false,
    });
  }
};

/****************************************************************************************************
REGISTRATIONS AUTHENTICATION => ENDS
 ***************************************************************************************************/

/****************************************************************************************************
LOGIN AUTHENTICATION => STARTS
 ***************************************************************************************************/
/**
 * @DESC To login the user (ADMIN, USER)
 */
const userLogin = async (userCreds, role, res) => {
  const { email, password } = userCreds;

  console.log("user cred", userCreds);

  // Check if the user exists using email only
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({
      message: "User not found. Invalid login credentials.",
      success: false,
    });
  }

  // we will check the role
  if (user.role !== role) {
    return res.status(403).json({
      message: "Please make sure you are loggin in from the right portal.",
      success: false,
    });
  }

  // That means user is existing and trying to signin from the right portal
  //Now check for the password
  let isMatch = await bcrypt.compare(password, user.password);
  if (isMatch) {
    //Sign in the token and issue it to the user
    let token = jwt.sign(
      {
        _id: user._id,
        username: user.username,
        role: user.role,
        email: user.email,
      },
      SECRET,
      { expiresIn: "7 days" }
    );

    let result = {
      role: user.role,
      _id: user._id,
      username: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      package: user.package,
      token: `Bearer ${token}`,
      expiresIn: 168,
    };

    return res.status(200).json({
      ...result,
      message: "Login successful.",
      success: true,
    });
  } else {
    return res.status(403).json({
      message: "Incorrect password",
      success: false,
    });
  }
};
/****************************************************************************************************
LOGIN AUTHENTICATION => ENDS
 ***************************************************************************************************/

/****************************************************************************************************
VALIDATE USERNAME => STARTS
 ***************************************************************************************************/
const validateUsername = async (username) => {
  let user = await User.findOne({ username });
  return user ? false : true;
};

/**
 * @DESC Passport middleware
 */
const userAuth = passport.authenticate("jwt", { session: false });
/****************************************************************************************************
VALIDATE USERNAME => ENDS
 ***************************************************************************************************/

/****************************************************************************************************
ROLES BASED AUTHENTICATION => STARTS
 ***************************************************************************************************/
/**
 * @DESC Check Role Middleware
 */
const checkRole = (roles) => (req, res, next) =>
  !roles.includes(req.user.role)
    ? res.status(401).json("Unauthorized")
    : next();

/****************************************************************************************************
ROLES BASED AUTHENTICATION => ENDS
 ***************************************************************************************************/

/****************************************************************************************************
VALIDATE EMAIL => STARTS
 ***************************************************************************************************/
const validateEmail = async (email) => {
  let user = await User.findOne({ email });
  return user ? false : true;
};
/****************************************************************************************************
VALIDATE EMAIL => ENDS
****************************************************************************************************/

/****************************************************************************************************
SERIALIZE USER => STARTS
 ***************************************************************************************************/
const serializeUser = (user) => {
  return {
    username: user.userName,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    birthday: user.birthday,
    dob: user.dob,
    biography: user.biography,
    address: user.address,
    phoneNumber: user.phoneNumber,
    gender: user.gender,
    followers: user.followers,
    followings: user.followings,
    createdAt: user.createdAt,
    updatedAt: user.createdAt,
    _id: user._id,
  };
};
/****************************************************************************************************
SERIALIZE USER => ENDS
 ***************************************************************************************************/

module.exports = {
  checkRole,
  serializeUser,
  userRegister,
  userLogin,
  userAuth,
};
