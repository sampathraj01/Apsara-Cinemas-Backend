const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");
const { generateHeaders, logError } = require("../utils/utils");
//const { generateInvoicePDF } = require("../utils/pdfGenerator"); // 🔹 You’ll create this helper

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);
//const s3 = new S3Client({ region: process.env.AWS_REGION });

const ORDER_TABLE = process.env.ORDER_TABLE;
//const BUCKET_NAME = process.env.S3_BUCKET_NAME;

module.exports.updateorderpaymentstatus = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { orderid, razorpay_payment_id, razorpay_signature, paymentstatus,paymentfailedreason } = body;

    if (!orderid || !paymentstatus) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({
          success: false,
          message: "orderid, razorpay_order_id, and paymentstatus are required",
          color: "warning",
        }),
      };
    }

    // Fetch existing order
    const orderResult = await dynamoDb.send(new GetCommand({
      TableName: ORDER_TABLE,
      Key: { orderid },
    }));

    if (!orderResult.Item) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false,  message: "Order not found",  color: "warning",}),
      };
    }

    const order = orderResult.Item;

   // Update base fields
let updateExpression = "SET paymentstatus = :paymentstatus, paymenttimeStamp = :paymenttimeStamp";
let expressionValues = {
  ":paymentstatus": paymentstatus,
  ":paymenttimeStamp": new Date().toISOString(),
};

// Add fields based on status
if (paymentstatus === "success") {
  updateExpression +=
    ", razorpay_payment_id = :razorpay_payment_id, razorpay_signature = :razorpay_signature";
  expressionValues[":razorpay_payment_id"] = razorpay_payment_id;
  expressionValues[":razorpay_signature"] = razorpay_signature;

  // Generate invoice PDF (function returns buffer)
//   const pdfBuffer = await generateInvoicePDF(order);

//   // Upload to S3
//   const fileKey = `invoices/${orderid}-${Date.now()}.pdf`;
//   await s3.send(
//     new PutObjectCommand({
//       Bucket: BUCKET_NAME,
//       Key: fileKey,
//       Body: pdfBuffer,
//       ContentType: "application/pdf",
//     })
//   );

//   const pdfUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;

  // updateExpression += ", invoiceurl = :invoiceurl";
  // expressionValues[":invoiceurl"] = pdfUrl;
} else if (paymentstatus === "failed") {
  updateExpression += ", paymentfailedreason = :paymentfailedreason";
  expressionValues[":paymentfailedreason"] = paymentfailedreason || "Unknown error";
}

// Update DynamoDB
await dynamoDb.send(
  new UpdateCommand({
    TableName: ORDER_TABLE,
    Key: { orderid },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionValues,
  })
);


    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({ success: true, message: paymentstatus === "success" ? "Payment successful. Invoice generated." : "Payment failed. Order updated.", color: "success",}),
    };
  } catch (error) {
    console.error("❌ Error updating payment status:", error);
    await logError(ORDER_TABLE, "updateorderpaymentstatus", error.message, null);

    return {
      statusCode: 500,
      headers: generateHeaders(),
      body: JSON.stringify({
        success: false,
        message: "Error updating payment status",
        color: "warning",
      }),
    };
  }
};
