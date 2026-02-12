const { auth } = require("express-oauth2-jwt-bearer");

const jwtCheck = auth({
  audience: "https://ontrack-api",
  issuerBaseURL: "https://dev-ni8q0awoq86bppws.us.auth0.com",
  tokenSigningAlg: "RS256",
});

module.exports = jwtCheck;
