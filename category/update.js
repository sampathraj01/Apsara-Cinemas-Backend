const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand,GetCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const s3 = new S3Client({ region: process.env.AWS_REGION });
const { generateHeaders, verifyAppToken, capitalize, logError } = require("../utils/utils");
const path = require("path");
const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);

const CATEGORY_TABLE = process.env.CATEGORY_TABLE;
const USERS_TABLE = process.env.USER_TABLE;
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

module.exports.updatecategory = async (event) => {
  try {
    const tokenString = event.headers?.Authorization || event.headers?.authorization;

    //  Verify token
    const verifiedUser = await verifyAppToken(tokenString);
    if (!verifiedUser) {
      return {
        statusCode: 403,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false, message: "Not verified User",color:"warning" }),
      };
    }

    //  Parse request body

    const { categoryid } = event.pathParameters || {};
    const {  categoryname, userid, iconBase64, iconName } = JSON.parse(event.body || "{}");
    if ( !categoryname) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false, message: "Category id and Name are required" ,color:"warning"}),
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

    //  Check if the new name already exists in another category
    const scanParams = new ScanCommand({
      TableName: CATEGORY_TABLE,
      FilterExpression: "categoryname = :categoryname AND categoryid <> :categoryid",
      ExpressionAttributeValues: {
        ":categoryname": displayCategoryName,
        ":categoryid": categoryid,
      },
    });

    const scanResult = await dynamoDb.send(scanParams);
    if (scanResult.Items && scanResult.Items.length > 0) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false, message: "Category name already exists",color:"warning" }),
      };
    }

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

    //  Update item
    const updatedtime = new Date().toISOString();

    let updateExpression =
    "SET categoryname = :categoryname, updatedBy = :updatedBy, updatedtime = :updatedtime";

    const expressionAttributeValues = {
      ":categoryname": displayCategoryName,
      ":updatedBy": userName,
      ":updatedtime": updatedtime,
    };
    if (iconUrl) {
      updateExpression += ", icon = :icon";
      expressionAttributeValues[":icon"] = iconUrl;
    }

    const updateParams = new UpdateCommand({
      TableName: CATEGORY_TABLE,
      Key: { categoryid },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    });

   const result = await dynamoDb.send(updateParams)

    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({ success: true, message: "Category updated successfully", color: "success", data: result.Attributes,}),
    };
  } catch (error) {
    console.error("Error updating category:", error);

    await logError(CATEGORY_TABLE, "updatecategory", error.message, null);

    return {
      statusCode: 500,
      headers: generateHeaders(),
      body: JSON.stringify({ success: false, message: "Error updating category", color: "warning",}),
    };
  }
};
