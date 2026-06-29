const jwt = require("jsonwebtoken");

//The current implementation of the auth middleware requires a token for all requests, 
//which prevents non-logged-in users from accessing the product data. To allow non-logged-in users to 
//view the product catalogue, we need to adjust the middleware and the route handling, check auth2

function auth(req, res, next) {
  const authHeader = req.header("Authorization");

  if (!authHeader) return res.status(401).json({ message: "No token, authorization denied" });

  const token = authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET); // Use the secret key from environment variables
    req.user = decoded.userId;

    /*

    Middleware Execution:
When a request is made to the "/" route, the auth middleware is executed first.
The auth middleware verifies the JWT, extracts the userId from the token, and sets req.user to this userId.
Accessing req.user:
After the auth middleware successfully verifies the token and sets req.user, the route handler can access req.user.
In this case, Item.find({ user: req.user }) uses req.user to filter items by the user ID, ensuring that only 
items belonging to the authenticated user are retrieved.
    */
    next();
  } catch (err) {
    // console.error("Token verification error:", err); // Debug statement
    res.status(400).json({ message: "Token is not valid" });
  }
}

module.exports = auth;
