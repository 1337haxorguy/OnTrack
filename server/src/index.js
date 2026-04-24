const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose")

const { jwtCheck } = require("./middleware/auth");
const generateRoute = require("./routes/generate");
const playgroundRoute = require("./routes/playground");
const syncUserRoute = require("./routes/syncUser");
const userDataRoute = require("./routes/userData");

const app = express();
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err))

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());

app.use("/api/generate", generateRoute);
app.use("/api/sync-user", jwtCheck, syncUserRoute);
app.use("/api/user-data", jwtCheck, userDataRoute);
app.use("/api/playground", playgroundRoute);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
