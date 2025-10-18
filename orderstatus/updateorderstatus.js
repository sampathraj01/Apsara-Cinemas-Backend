const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { generateHeaders, logError } = require("../utils/utils");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);

const ORDER_TABLE = process.env.ORDER_TABLE;

module.exports.updateorderstatus = async (event) => {
  try {
    console.log("🟢 Incoming Event:", event);

    // Parse body
    const { orderNo } = JSON.parse(event.body || "{}");

    // ✅ Validation
    if (!orderNo) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({
          success: false,
          message: "orderNo is required",
          color: "warning",
        }),
      };
    }

    // ✅ Step 1: Find the order using orderNo
    const scanResult = await dynamoDb.send(
      new ScanCommand({
        TableName: ORDER_TABLE,
        FilterExpression: "#orderNo = :orderNoVal",
        ExpressionAttributeNames: {
          "#orderNo": "orderNo",
        },
        ExpressionAttributeValues: {
          ":orderNoVal": orderNo,
        },
        Limit: 1,
      })
    );

    if (!scanResult.Items || scanResult.Items.length === 0) {
      return {
        statusCode: 404,
        headers: generateHeaders(),
        body: JSON.stringify({
          success: false,
          message: "Order not found for the given orderNo",
          color: "warning",
        }),
      };
    }

    const foundOrder = scanResult.Items[0];
    const orderid = foundOrder.orderid;

    // ✅ Step 2: Update orderstatus to Delivered
    await dynamoDb.send(
      new UpdateCommand({
        TableName: ORDER_TABLE,
        Key: { orderid },
        UpdateExpression: "SET orderstatus = :status",
        ExpressionAttributeValues: {
          ":status": "Delivered",
        },
      })
    );

    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({
        success: true,
        message: `Order #${orderNo} marked as Delivered successfully.`,
        color: "success",
      }),
    };
  } catch (error) {
    console.error("❌ Error updating order status:", error);
    await logError(ORDER_TABLE, "updateorderstatus", error.message, null);

    return {
      statusCode: 500,
      headers: generateHeaders(),
      body: JSON.stringify({
        success: false,
        message: "Error updating order status",
        color: "error",
      }),
    };
  }
};
