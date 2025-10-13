const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand,GetCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const s3 = new S3Client({ region: process.env.AWS_REGION });
const { generateHeaders, verifyAppToken, capitalize, logError } = require("../utils/utils");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);
const path = require("path");

const CATEGORY_TABLE = process.env.CATEGORY_TABLE;
const USERS_TABLE = process.env.USER_TABLE;
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

module.exports.addcategory = async (event) => {
  try {
    const tokenString = event.headers?.Authorization || event.headers?.authorization;

    // ✅ Verify token
    const verifiedUser = await verifyAppToken(tokenString);

    if (!verifiedUser) {
      return {
        statusCode: 403,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false, message: "Not verified User", color: "warning" }),
      };
    }

    //  Parse and validate input
    const { categoryname, userid, iconBase64, iconName } = JSON.parse(event.body || "{}");

    if (!categoryname || !categoryname.trim()) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false, message: "Category name is required",color: "warning", }),
      };
    }

      const userResult = await dynamoDb.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { id: userid }, // assuming 'id' is the PK
      })
    );

    const userName = userResult.Item?.name || "Unknown";

    //  Normalize and capitalize name
    const normalizedCategoryName = categoryname.trim().toLowerCase();
    const displayCategoryName = capitalize(normalizedCategoryName);

    //  Check if category already exists
    const scanParams = new ScanCommand({
      TableName: CATEGORY_TABLE,
      FilterExpression: "categoryname = :categoryname",
      ExpressionAttributeValues: {
        ":categoryname": displayCategoryName,
      },
    });

    const scanResult = await dynamoDb.send(scanParams);

    if (scanResult.Items && scanResult.Items.length > 0) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({
          success: false,
          message: "Category name already exists",
          color: "warning",
        }),
      };
    }
    // deply in s3
    let iconUrl = null;
    if (iconBase64 && iconName) {
      const buffer = Buffer.from(iconBase64, "base64");
      const ext = path.extname(iconName).toLowerCase();

      // detect type properly
      let contentType;
      if (ext === ".svg") contentType = "image/svg+xml";
      else if (ext === ".png") contentType = "image/png";
      else {
        return {
          statusCode: 400,
          headers: generateHeaders(),
          body: JSON.stringify({ success: false, message: "Only .svg or .png files allowed", color: "warning",}),
        };
      }

    const fileKey = `category/${Date.now()}-${iconName}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileKey,
          Body: buffer,
          ContentType: contentType,
        })
      );

      iconUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
    }


    // ✅ Prepare new category data
    const categoryid = Date.now().toString();
    const createdtime = new Date().toISOString();

    const categoryData = {
      categoryid,
      categoryname: displayCategoryName,
      icon: iconUrl,
      createdBy: userName,
      createdtime,
    };

    // ✅ Insert new category
    const putParams = new PutCommand({
      TableName: CATEGORY_TABLE,
      Item: categoryData,
    });

    await dynamoDb.send(putParams);

    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({ success: true, message: "Category added successfully", color: "success", data: categoryData,}),
    };
  } catch (error) {
    console.error("Error processing request:", error);

    // ✅ Log the error to DynamoDB (optional utility)
    await logError(CATEGORY_TABLE, "addcategory", error.message, null);

    return {
      statusCode: 500,
      headers: generateHeaders(),
      body: JSON.stringify({ success: false, message: "Error processing request", color: "warning", data: error.message,}),
    };
  }
};
