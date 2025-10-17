const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { generateHeaders, logError } = require("../utils/utils");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);

const ORDER_TABLE = process.env.ORDER_TABLE;
const ORDERLIST_TABLE = process.env.ORDERLIST_TABLE;

module.exports.getRecentOrders = async (event) => {
  try {
    // 1️⃣ Get all unprinted successful orders
    const orderResult = await dynamoDb.send(
      new ScanCommand({
        TableName: ORDER_TABLE,
        FilterExpression: "paymentstatus = :success AND printflag = :printflag",
        ExpressionAttributeValues: {
          ":success": "success",
          ":printflag": false,
        },
      })
    );

    const orders = orderResult.Items || [];
    if (orders.length === 0) {
      return {
        statusCode: 200,
        headers: generateHeaders(),
        body: JSON.stringify({ orders: [] }),
      };
    }

    // 2️⃣ For each order, fetch its products from ORDERLIST_TABLE
    const fullOrders = await Promise.all(
      orders.map(async (order) => {
        const orderlistResult = await dynamoDb.send(
          new ScanCommand({
            TableName: ORDERLIST_TABLE,
            FilterExpression: "orderrefid = :orderrefid",
            ExpressionAttributeValues: { ":orderrefid": order.orderid },
          })
        );

        return {
          ...order,
          products: orderlistResult.Items || [],
        };
      })
    );

    // 3️⃣ Return combined data
    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({ orders: fullOrders }),
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
