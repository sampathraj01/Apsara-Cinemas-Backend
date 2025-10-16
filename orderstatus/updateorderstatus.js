const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { generateHeaders, logError } = require("../utils/utils");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);

const ORDER_TABLE = process.env.ORDER_TABLE;

module.exports.updateorderstatus = async (event) => {
  try {
    console.log("🟢 Incoming Event:", event);

    // const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    // const { orderid, orderstatus } = body || {};

    // // ✅ Validation
    // if (!orderid) {
    //   return {
    //     statusCode: 400,
    //     headers: generateHeaders(),
    //     body: JSON.stringify({
    //       success: false,
    //       message: "orderid is required",
    //       color: "warning",
    //     }),
    //   };
    // }

    // // ✅ Default to 'Delivered' if no status passed
    // const newStatus = orderstatus || "Delivered";

    // // ✅ Update order status in DynamoDB
    // await dynamoDb.send(
    //   new UpdateCommand({
    //     TableName: ORDER_TABLE,
    //     Key: { orderid },
    //     UpdateExpression: "SET orderstatus = :status",
    //     ExpressionAttributeValues: {
    //       ":status": newStatus,
    //     },
    //   })
    // );

    // return {
    //   statusCode: 200,
    //   headers: generateHeaders(),
    //   body: JSON.stringify({
    //     success: true,
    //     message: `Order status updated to '${newStatus}' successfully`,
    //     color: "success",
    //   }),
    // };
  } catch (error) {
    console.error("❌ Error updating order status:", error);
    // await logError(ORDER_TABLE, "updateorderstatus", error.message, null);

    // return {
    //   statusCode: 500,
    //   headers: generateHeaders(),
    //   body: JSON.stringify({
    //     success: false,
    //     message: "Error updating order status",
    //     color: "error",
    //   }),
    // };
  }
};
