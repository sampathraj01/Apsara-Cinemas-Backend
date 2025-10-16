const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { generateHeaders, logError } = require("../utils/utils");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);
const ORDER_TABLE = process.env.ORDER_TABLE;

module.exports.markPrinted = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { orderid } = body;

    if (!orderid) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false, message: "orderid is required", color: "warning" }),
      };
    }

    await dynamoDb.send(new UpdateCommand({
      TableName: ORDER_TABLE,
      Key: { orderid },
      UpdateExpression: "SET printflag = :printflag",
      ExpressionAttributeValues: { ":printflag": true }
    }));

    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({ success: true, message: "Order marked as printed", color: "success" }),
    };
  } catch (error) {
    await logError(ORDER_TABLE, "markPrinted", error.message, null);
    return {
      statusCode: 500,
      headers: generateHeaders(),
      body: JSON.stringify({ success: false, message: error.message, color: "warning" }),
    };
  }
};
