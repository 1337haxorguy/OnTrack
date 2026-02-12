const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose")

const jwtCheck = require("./middleware/auth");
const generateRoute = require("./routes/generate");
const playgroundRoute = require("./routes/playground");
const syncUserRoute = require("./routes/syncUser");

const app = express();
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err))

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

app.use("/api/generate", jwtCheck, generateRoute);
app.use("/api/sync-user", jwtCheck, syncUserRoute);
app.use("/api/playground", playgroundRoute);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
