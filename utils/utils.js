const AWS = require("aws-sdk");
const jwt = require("jsonwebtoken");

const dynamoDB = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION,
});

const ERROR_LOG_TABLE = process.env.ERRORLOG_TABLE;

// ✅ Generate CORS + JSON headers
const generateHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': true,
  'Content-Type': 'application/json'
});

// ✅ Capitalize helper
const capitalize = (str) => {
  if (!str) return "";
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
};

// ✅ Error logger (for DynamoDB)
const logError = async (tableName, type, errorLog, name) => {
  const params = {
    TableName: ERROR_LOG_TABLE,
    Item: {
      errorlogid: Date.now().toString(),
      tableName,
      type,
      error: errorLog.toString(),
      createduserid: name || "unknown",
      createdtimestamp: new Date().toISOString(),
    },
  };

  try {
    await dynamoDB.put(params).promise();
  } catch (err) {
    console.error("Failed to log error:", err);
  }
};

// ✅ Verify custom app JWT token (from login)
const verifyAppToken = async (authHeader) => {
  try {
    if (!authHeader) return null;

    // Extract Bearer token
    const token = authHeader.split(" ")[1];
    if (!token) return null;

    // Verify JWT using your secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Optional: check token expiry manually
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp < currentTime) return null;

    // Token is valid, return decoded payload
    return decoded;
  } catch (err) {
    console.error("Token verification failed:", err.message);
    return null;
  }
};


module.exports = {
  generateHeaders,
  capitalize,
  logError,
  verifyAppToken,
};
