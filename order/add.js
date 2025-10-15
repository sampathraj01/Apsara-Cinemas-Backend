const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { generateHeaders, logError } = require("../utils/utils");
const Razorpay = require("razorpay");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);

const ORDER_TABLE = process.env.ORDER_TABLE;
const ORDERLIST_TABLE = process.env.ORDERLIST_TABLE;

module.exports.addorder = async (event) => {
  try {
    // Parse input
    const { amount, phoneNumber, name, seatNo, products } = JSON.parse(event.body || "{}");
    console.log("📦 Received Body:", { amount, phoneNumber, name, seatNo, products });

    if (!amount || !phoneNumber || !name || !seatNo || !Array.isArray(products) || products.length === 0) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({
          success: false,
          message: "amount, phoneNumber, name, seatNo and products are required",
          color: "warning",
        }),
      };
    }

    // NOTE: Scanning entire orders table for orderNo is ok for small tables.
    // For production / large tables use a counter item (recommended).
    const scanParams = {
      TableName: ORDER_TABLE,
      ProjectionExpression: "orderNo",
    };

    const scanResult = await dynamoDb.send(new ScanCommand(scanParams));
    let orderNo = 1; // default

    if (Array.isArray(scanResult.Items) && scanResult.Items.length > 0) {
      const orderNos = scanResult.Items
        .map((it) => Number(it.orderNo))

      if (orderNos.length > 0) {
        orderNo = Math.max(...orderNos) + 1;
      }
    }

    const formattedOrderNo = orderNo.toString().padStart(3, "0");
    console.log("Next orderNo:", formattedOrderNo);

    // Create Razorpay order
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_RTETuyApMx9Y6C",
      key_secret: process.env.RAZORPAY_KEY_SECRET || "Y1Db9TB5uTnxUGeA5QlBYoBK",
    });

    const amountInPaise = Math.round(parseFloat(amount) * 100);
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });
    const razorpay_order_id = razorpayOrder.id;

    // Prepare order record
    const orderid = Date.now().toString();
    const createdtime = new Date().toISOString();

    const orderData = {
      orderid,
      orderNo: formattedOrderNo,
      phoneNumber,
      name,
      seatNo,
      createdtime,
      Razorpayorderid: razorpay_order_id,
      paymentstatus: "pending",
    };

    // Save order
    await dynamoDb.send(
      new PutCommand({
        TableName: ORDER_TABLE,
        Item: orderData,
      })
    );

    // Save products (order list) in parallel
    const orderlistPromises = products.map((product) => {
      const orderlistData = {
        orderlistid: `${orderid}-${product.productid}-${Date.now().toString()}`,
        orderrefid: orderid,
        productid: product.productid,
        productname: product.name,
        photo: product.photo,
        qty: (Number(product.qty)),
        price: parseFloat(Number(product.price)),
        total: parseFloat(Number(product.total).toFixed(2)),
        createdtime,
      };

      return dynamoDb.send(
        new PutCommand({
          TableName: ORDERLIST_TABLE,
          Item: orderlistData,
        })
      );
    });

    await Promise.all(orderlistPromises);

    const data = {
      razorpay_order_id,
      orderId: orderid,
      orderNo: formattedOrderNo,
      createdtime,
    };

    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({ success: true, message: "order added successfully", color: "success", data }),
    };
  } catch (error) {
    console.error("Error in addorder:", error);
    await logError(ORDER_TABLE, "addorder", error.message, null);

    return {
      statusCode: 500,
      headers: generateHeaders(),
      body: JSON.stringify({ success: false, message: "Error adding order", color: "warning", data: error.message }),
    };
  }
};
