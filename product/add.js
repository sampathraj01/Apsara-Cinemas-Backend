const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand,} = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");
const { generateHeaders,verifyAppToken,logError,} = require("../utils/utils");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);
const s3 = new S3Client({ region: process.env.AWS_REGION });

const PRODUCT_TABLE = process.env.PRODUCT_TABLE;
const CATEGORY_TABLE = process.env.CATEGORY_TABLE;
const USERS_TABLE = process.env.USER_TABLE;
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

module.exports.addproduct = async (event) => {
  try {
    // 🔐 Verify JWT token
    const tokenString = event.headers?.Authorization || event.headers?.authorization;
    const verifiedUser = await verifyAppToken(tokenString);

    if (!verifiedUser) {
      return {
        statusCode: 403,
        headers: generateHeaders(),
        body: JSON.stringify({
          success: false,
          message: "Unauthorized user. Invalid token.",
          color: "warning",
        }),
      };
    }

    //  Parse input
    const { categoryid, product, photo, userid,price,foodtype } = JSON.parse(event.body || "{}");
    console.log("📦 Received Body:", { categoryid, product, userid, price, foodtype });
    console.log("🖼️ Photo details:", photo ? { name: photo.name, type: photo.type } : "No photo");
    if (!categoryid || !product || !photo || !userid || !foodtype) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false, message: "categoryid, product, photo, and userid are required", color: "warning", }),
      };
    }

    //  Fetch Category
    const categoryResult = await dynamoDb.send(
      new GetCommand({
        TableName: CATEGORY_TABLE,
        Key: { categoryid },
      })
    );

    if (!categoryResult.Item) {
      return {
        statusCode: 404,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false,message: "Category not found", color: "warning",}),
      };
    }

    const categoryname = categoryResult.Item.categoryname;

    //  Fetch User Name
    const userResult = await dynamoDb.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { id: userid },
      })
    );

    const userName = userResult.Item?.name || "Unknown";

    //  Upload product image
    let photoUrl = null;
    try {
      const { base64, name, type } = photo; // photo from frontend: { base64, name, type }

      //  Validate allowed types
      const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
      if (!allowedTypes.includes(type)) {
        return {
          statusCode: 400,
          headers: generateHeaders(),
          body: JSON.stringify({ success: false, message: "Only JPEG, PNG, JPG, or WEBP images are allowed", color: "warning",}),
        };
      }

      const buffer = Buffer.from(base64, "base64");
      const ext = path.extname(name).toLowerCase();

      const fileKey = `products/${Date.now()}-${name}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileKey,
          Body: buffer,
          ContentType: type,
        })
      );

      photoUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
    } catch (uploadError) {
      console.error("Error uploading product photo:", uploadError);
      throw new Error("Error uploading product photo");
    }

    //  Save product to DynamoDB
    const productid = Date.now().toString();
    const createdtime = new Date().toISOString();

    const productData = {
      productid,
      productname: product,
      categoryid,
      categoryname,
      photo: photoUrl,
      foodtype,
      price,
      createdBy: userName,
      createdtime,
       flag: true,
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: PRODUCT_TABLE,
        Item: productData,
      })
    );

    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({ success: true, message: "Product added successfully", color: "success", data: productData,}),
    };
  } catch (error) {
    console.error("Error in addproduct:", error);

    await logError(PRODUCT_TABLE, "addproduct", error.message, null);

    return {
      statusCode: 500,
      headers: generateHeaders(),
      body: JSON.stringify({ success: false, message: "Error adding product", color: "warning", data: error.message, }),
    };
  }
};
