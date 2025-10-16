const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { generateHeaders, logError } = require("../utils/utils");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);

const ORDER_TABLE = process.env.ORDER_TABLE;

module.exports.getorderstatusbyid = async (event) => {
  try {
    console.log("🟢 Incoming Event:", event);

    const { orderid } = event.pathParameters || {};

    // ✅ Validation
    if (!orderid) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({
          success: false,
          message: "orderid is required",
          color: "warning",
        }),
      };
    }

    // ✅ Fetch order from DynamoDB
    const orderResult = await dynamoDb.send(
      new GetCommand({
        TableName: ORDER_TABLE,
        Key: { orderid },
      })
    );

    if (!orderResult.Item) {
      return {
        statusCode: 404,
        headers: generateHeaders(),
        body: JSON.stringify({
          success: false,
          message: "Order not found",
          color: "warning",
        }),
      };
    }

    const { orderstatus, paymentstatus, orderNo, name, amount, seatNo } = orderResult.Item;

    // ✅ Return only necessary fields
    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({
        success: true,
        message: "Order status fetched successfully",
        color: "success",
        data: {
          orderid,
          orderNo,
          orderstatus,
          paymentstatus,
          name,
          seatNo,
          amount,
        },
      }),
    };
  } catch (error) {
    console.error("❌ Error fetching order status:", error);
    await logError(ORDER_TABLE, "getorderstatus", error.message, null);

    return {
      statusCode: 500,
      headers: generateHeaders(),
      body: JSON.stringify({
        success: false,
        message: "Error fetching order status",
        color: "error",
      }),
    };
  }
};
