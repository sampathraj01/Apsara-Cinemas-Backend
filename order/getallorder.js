const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { generateHeaders, logError } = require("../utils/utils");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);

const ORDER_TABLE = process.env.ORDER_TABLE;

module.exports.getallorders = async (event) => {
  try {
    // Scan DynamoDB orders table
    const scanParams = {
      TableName: ORDER_TABLE,
    };

    const result = await dynamoDb.send(new ScanCommand(scanParams));

    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({ success: true, message: "Orders fetched successfully", color: "success", data: result.Items || [], }),
    };
  } catch (error) {
    console.error("Error fetching orders:", error);
    await logError(ORDER_TABLE, "getallorders", error.message, null);

    return {
      statusCode: 500,
      headers: generateHeaders(),
      body: JSON.stringify({ success: false, message: "Error fetching orders", color: "warning", data: error.message,}),
    };
  }
};
