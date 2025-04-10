const express = require("express");
const { success, error } = require("consola");
const { connect } = require("mongoose");
const passport = require("passport");
const { DB, PORT } = require("./config");

const app = express(); // Initialize the application

var cors = require("cors");
app.use(cors({ origin: true, credentials: true }));

// Middlewares
app.use(express.json());
app.use(passport.initialize());

require("./middlewares/passport")(passport);

app.get("/scheduled-task", (req, res) => {
  console.log("Scheduled task triggered!");
  // Run your task here, e.g., database cleanup, sending emails, etc.
  res.send("Task completed");
});

// User Router Middleware
app.use("/api/users", require("./routes/users"));
app.use("/api/code", require("./routes/packageCode"));
app.use("/api/package", require("./routes/package"));
app.use("/api/transactions", require("./routes/transactions"));
app.use("/api/genealogy", require("./routes/genealogy"));
app.use("/api/notification", require("./routes/notification"));

const startApp = async () => {
  try {
    // Connection with DB
    await connect(DB, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    });

    success({
      message: `Successfully connected with the Database \n${DB}`,
      badge: true,
    });

    // Start listening for the server on PORT
    app.listen(PORT, () =>
      success({ message: `Server started on PORT ${PORT}`, badge: true })
    );
  } catch (err) {
    error({
      message: `Unable to connect with Database \n${err}`,
      badge: true,
    });
    process.exit(1); // Exit the process with an error code
  }
};

startApp();
