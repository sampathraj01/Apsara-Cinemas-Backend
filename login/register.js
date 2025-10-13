// registerHandler.js

const { DynamoDBClient, ScanCommand, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { generateHeaders } = require("../utils/utils");

const dynamoDb = new DynamoDBClient({ region: process.env.AWS_REGION });
const USERS_TABLE = process.env.USER_TABLE;

// REGISTER HANDLER (AWS SDK v3)
module.exports.registerHandler = async (event) => {
  console.log("Received event:", JSON.stringify(event));

  try {
    const { email, password, name } = JSON.parse(event.body);

    if (!email || !password) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false, message: "Email and password required" })
      };
    }

    // 1️ Check if user already exists
    const scanParams = new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: "email = :email",
      ExpressionAttributeValues: {
        ":email": { S: email }
      }
    });

    const existing = await dynamoDb.send(scanParams);

    if (existing.Items && existing.Items.length > 0) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false, message: "User already exists" })
      };
    }

    // 2️ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3️ Create new user item
    const id = uuidv4(); // match your DynamoDB partition key
    const putParams = new PutItemCommand({
      TableName: USERS_TABLE,
      Item: {
        id: { S: id },
        email: { S: email },
        password: { S: hashedPassword },
        name: { S: name || "" },
        createdAt: { S: new Date().toISOString() }
      }
    });

    await dynamoDb.send(putParams);

    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({ success: true, message: "User registered successfully",id, name })
    };
  } catch (err) {
    console.error("Error:", err);
    return {
      statusCode: 500,
      headers: generateHeaders(),
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
