const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { generateHeaders, logError } = require("../utils/utils");
const Razorpay = require("razorpay");
const moment = require("moment-timezone");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);

const ORDER_TABLE = process.env.ORDER_TABLE;
const ORDERLIST_TABLE = process.env.ORDERLIST_TABLE;

module.exports.addorder = async (event) => {
  try {
    const { amount, phoneNumber, name, seatNo, products } = JSON.parse(event.body || "{}");

    // Step 1 -> Required Fields Check 
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

    // Step 2 -> Get Maximam OrderNo
    const scanParams = {
      TableName: ORDER_TABLE,
      ProjectionExpression: "orderNo",
    };

    const scanResult = await dynamoDb.send(new ScanCommand(scanParams));
    let orderNo = 1; 

    if (Array.isArray(scanResult.Items) && scanResult.Items.length > 0) {
      const orderNos = scanResult.Items
        .map((it) => Number(it.orderNo))

      if (orderNos.length > 0) {
        orderNo = Math.max(...orderNos) + 1;
      }
    }

    // Step 3 -> Formatted OrderNo
    const formattedOrderNo = orderNo.toString().padStart(3, "0");

    // Step 4 -> Create Razorpay order
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || "rzp_live_RUUulcgGzP6EKt",
      key_secret: process.env.RAZORPAY_KEY_SECRET || "DreJjErMcTLiQ9Lx50lVoSbo",
    });

    const amountInPaise = Math.round(parseFloat(amount) * 100);
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });
    const razorpay_order_id = razorpayOrder.id;

    // Step 5 -> Insert Data in Order table
    const orderid = Date.now().toString();
    const createdtime = new Date().toISOString();

    const orderdate = moment().tz("Asia/Kolkata").format("YYYY-MM-DD"); 
    const ordertime = moment().tz("Asia/Kolkata").format("hh:mm A");

    const orderData = {
      orderid,
      orderdate,
      ordertime,
      orderNo: formattedOrderNo,
      phoneNumber,
      name,
      amount,
      seatNo,
      createdtime,
      Razorpayorderid: razorpay_order_id,
      paymentstatus: "pending",
      orderstatus : "notdelivered",
      printflag: false
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: ORDER_TABLE,
        Item: orderData,
      })
    );

    // Step 6 -> Insert Product list in Orderlist table
    const orderlistPromises = products.map((product) => {
      const total = (product.qty * product.price)
      const orderlistData = {
        orderlistid: `${orderid}-${product.productid}-${Date.now().toString()}`,
        orderrefid: orderid,
        productid: product.productid,
        productname: product.name,
        photo: product.photo,
        qty: (Number(product.qty)),
        price: parseFloat(Number(product.price)),
        total: parseFloat(Number(total).toFixed(2)),
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

    // Step 7 -> Send Response Frontend
    const data = {
      razorpay_order_id,
      orderId: orderid,
      orderdate,
      ordertime,
      orderNo: formattedOrderNo,
      createdtime,
    };

    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({ success: true, message: "order added successfully", color: "success", data }),
    };
    } 
    catch (error) {
      await logError(ORDER_TABLE, "addorder", error.message, null);
      return {
        statusCode: 500,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false, message: error.message , color: "error",  }),
      };
  }
};