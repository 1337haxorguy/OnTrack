const express = require("express")
const router = express.Router()
const User = require("../../models/user")

router.get("/create-test-user", async (req, res) => {
  try {
    // hardcoded test identity
    const testAuth0Sub = "test|12345"

    // check if user already exists
    let user = await User.findOne({ auth0Sub: testAuth0Sub })

    if (user) {
      return res.json({
        message: "Test user already exists",
        user
      })
    }

    // create new user
    user = await User.create({
      auth0Sub: testAuth0Sub,
      email: "testuser@example.com",
    })

    res.status(201).json({
      message: "Test user created",
      user
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to create test user" })
  }
})

module.exports = router
