const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { generateHeaders, logError } = require("../utils/utils");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);

const ORDER_TABLE = process.env.ORDER_TABLE;

module.exports.getRecentOrders = async (event) => {
  try {
    const result = await dynamoDb.send(new ScanCommand({
      TableName: ORDER_TABLE,
      FilterExpression: "paymentstatus = :success AND printflag = :printflag",
      ExpressionAttributeValues: {
        ":success": "success",
        ":printflag": false
      }
    }));

    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({ orders: result.Items || [] })
    };
  } catch (error) {
    console.error("getRecentOrders error:", error);
    await logError(ORDER_TABLE, "getRecentOrders", error.message, null);
    return {
      statusCode: 500,
      headers: generateHeaders(),
      body: JSON.stringify({
        success: false,
        message: error.message,
        color: "warning",
      }),
    };
  }
};
