const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { generateHeaders, logError } = require("../utils/utils");
const moment = require("moment-timezone");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDB = DynamoDBDocumentClient.from(client);

const ORDER_TABLE = process.env.ORDER_TABLE;

module.exports.getallorders = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { fromdate, todate } = body;

    // Get today's date in YYYY-MM-DD format (based on IST)
    const today = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");

    const startDate = fromdate
      ? moment(fromdate).startOf("day")
      : moment(today).startOf("day");
    const endDate = todate
      ? moment(todate).endOf("day")
      : moment(today).endOf("day");

    // 🔹 Scan all orders
    const params = new ScanCommand({
      TableName: ORDER_TABLE,
    });

    const data = await dynamoDB.send(params);
    const items = data.Items || [];

    // 🔹 Filter between date range
    const filteredOrders = items.filter((order) => {
      if (!order.orderdate) return false;
      const orderDate = moment(order.orderdate);
      return orderDate.isBetween(startDate, endDate, null, "[]"); // inclusive
    });

    // 🔹 Sort by orderdate descending
    const sortedOrders = filteredOrders.sort(
      (a, b) => new Date(b.orderdate) - new Date(a.orderdate)
    );

    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({
        success: true,
        message: "Fetched orders successfully",
        color: "success",
        data: sortedOrders,
      }),
    };
  } catch (error) {
    console.error("Error fetching orders:", error);
    await logError(ORDER_TABLE, "getallorder", error.message, null);

    return {
      statusCode: 500,
      headers: generateHeaders(),
      body: JSON.stringify({
        success: false,
        message: "Error fetching orders",
        color: "warning",
        data: error.message,
      }),
    };
  }
};
