const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand ,UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { generateHeaders } = require("../utils/utils");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);

const USERS_TABLE = process.env.USER_TABLE;

// LOGIN API
module.exports.loginHandler = async (event) => {
  try {
    const { email, password , fcmtoken } = JSON.parse(event.body || "{}");

    if (!email || !password) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false, message: "Email and password required" }),
      };
    }

    //  Scan table to find user by email
    const scanParams = new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: "#em = :email",
      ExpressionAttributeNames: { "#em": "email" },
      ExpressionAttributeValues: { ":email": email },
    });

    const result = await dynamoDb.send(scanParams);
    const user = result.Items?.[0];

    if (!user) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false, message: "User not found" }),
      };
    }

    //  Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false, message: "Invalid credentials" }),
      };
    }

    //  Create JWT token
    const token = jwt.sign(
      { userid: user.id , name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    if (fcmtoken) {
      await dynamoDb.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { id: user.id },
        UpdateExpression: "SET #fcm = :fcmtoken",
        ExpressionAttributeNames: { "#fcm": "fcmToken" }, 
        ExpressionAttributeValues: { ":fcmtoken": fcmtoken },
      }));
    }

    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({ success: true, message: "Login successful", token, userid: user.id , name: user.name,}),
    };
  } catch (err) {
    console.error("Error:", err);
    return {
      statusCode: 500,
      headers: generateHeaders(),
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};