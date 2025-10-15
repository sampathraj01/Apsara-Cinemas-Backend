const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");
const { generateHeaders, logError } = require("../utils/utils");
//const { generateInvoicePDF } = require("../utils/pdfGenerator"); // 🔹 You’ll create this helper

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);

const ORDER_TABLE = process.env.ORDER_TABLE;

module.exports.updateorderpaymentstatus = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { orderid, razorpay_payment_id, razorpay_signature, paymentstatus, paymentfailedreason } = body;

    // Step 1 -> Required Field is missing send reposnse
    if (!orderid || !paymentstatus) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({
          success: false,
          message: "Required fields are missing",
          color: "warning",
        }),
      };
    }

    // Step 2 -> Get Order Details
    const orderResult = await dynamoDb.send(new GetCommand({
      TableName: ORDER_TABLE,
      Key: { orderid },
    }));

    if (!orderResult.Item) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false, message: "Order not found", color: "warning", }),
      };
    }

    const order = orderResult.Item;

    // Step 3 -> Update the payment details in order table
    let updateExpression = "SET paymentstatus = :paymentstatus, paymenttimeStamp = :paymenttimeStamp";
    let expressionValues = {
      ":paymentstatus": paymentstatus,
      ":paymenttimeStamp": new Date().toISOString(),
    };

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
      body: JSON.stringify({ success: true, message: paymentstatus === "success" ? "Payment success order placed " : "Payment failed .", color: "success", }),
    };
  } 
  catch (error) {
    await logError(ORDER_TABLE, "updateorderpaymentstatus", error.message, null);
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