const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");
const { generateHeaders, verifyAppToken, logError } = require("../utils/utils");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);
const s3 = new S3Client({ region: process.env.AWS_REGION });

const PRODUCT_TABLE = process.env.PRODUCT_TABLE;
const CATEGORY_TABLE = process.env.CATEGORY_TABLE;
const USERS_TABLE = process.env.USER_TABLE;
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

module.exports.updatecombo = async (event) => {
  try {
    const tokenString = event.headers?.Authorization || event.headers?.authorization;
    const verifiedUser = await verifyAppToken(tokenString);

    if (!verifiedUser) {
      return {
        statusCode: 403,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false, message: "Unauthorized user. Invalid token.", color: "warning", }),
      };
    }

    const { productid } = event.pathParameters || {};
    const body = JSON.parse(event.body || "{}");
    const { comboname,categoryid, foodtype, productids, description, userid, photo,price } = body;

    // Validation
    if (!productid || !comboname || !foodtype || !productids?.length || !userid || !price) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({
          success: false,
          message: "comboid, comboname, foodtype, productid array, and userid are required",
          color: "warning",
        }),
      };
    }

    // Fetch user name
    const userResult = await dynamoDb.send(
      new GetCommand({ TableName: USERS_TABLE, Key: { id: userid } })
    );
    const userName = userResult.Item?.name || "Unknown";
    
  const categoryResult = await dynamoDb.send(
        new GetCommand({ TableName: CATEGORY_TABLE, Key: { categoryid } })
      );
      if (!categoryResult.Item) {
        return { statusCode: 404, headers: generateHeaders(), body: JSON.stringify({ success: false, message: "Category not found", color: "warning" }) };
      }
      const categoryname = categoryResult.Item.categoryname;
    // Upload photo if provided
    let photoUrl;
    if (photo && photo.base64 && photo.name && photo.type) {
      const buffer = Buffer.from(photo.base64, "base64");
      const fileKey = `products/${Date.now()}-${photo.name}`;
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: buffer,
        ContentType: photo.type,
      }));
      photoUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
    }

    const updatedtime = new Date().toISOString();

    // Build update expression
    let updateExpression = "SET productname = :productname,categoryname = :categoryname, foodtype = :foodtype, productids = :productids, description = :description,price = :price, updatedBy = :updatedBy, updatedtime = :updatedtime";
    const expressionAttributeValues = {
      ":productname": comboname,
      ":categoryname":categoryname,
      ":foodtype": foodtype,
      ":productids": productids,
      ":description": description || "",
      ":price":price,
      ":updatedBy": userName,
      ":updatedtime": updatedtime,
    };
    if (photoUrl) {
      updateExpression += ", photo = :photo";
      expressionAttributeValues[":photo"] = photoUrl;
    }

    // Update combo
    const result = await dynamoDb.send(
      new UpdateCommand({
        TableName: PRODUCT_TABLE,
        Key: { productid },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      })
    );

    console.log("✅ Updated combo:", result.Attributes);

    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({ success: true, message: "Combo updated successfully", color: "success", data: result.Attributes,}),
    };
  } catch (error) {
    console.error("❌ Error updating combo:", error);
    await logError(PRODUCT_TABLE, "updatecombo", error.message, null);

    return {
      statusCode: 500,
      headers: generateHeaders(),
      body: JSON.stringify({ success: false, message: "Error updating combo", color: "warning", data: error.message, }),
    };
  }
};
