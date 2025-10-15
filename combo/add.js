const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand,} = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");
const { generateHeaders, verifyAppToken, logError,} = require("../utils/utils");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);
const s3 = new S3Client({ region: process.env.AWS_REGION });

const PRODUCT_TABLE = process.env.PRODUCT_TABLE; // add in serverless.yml
const CATEGORY_TABLE = process.env.CATEGORY_TABLE;
const USERS_TABLE = process.env.USER_TABLE;
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

module.exports.addcombo = async (event) => {
  try {
    //  Verify JWT token
    const tokenString =
      event.headers?.Authorization || event.headers?.authorization;
    const verifiedUser = await verifyAppToken(tokenString);

    if (!verifiedUser) {
      return {
        statusCode: 403,
        headers: generateHeaders(),
        body: JSON.stringify({success: false, message: "Unauthorized user. Invalid token.", color: "warning",}),
      };
    }

    // 🧾 Parse request body
    const {
      product,
      categoryid,
      productids,
      description,
      foodtype,
      price,
      photo,
      userid,
    } = JSON.parse(event.body || "{}");

    // ✅ Validate required fields
    if (
      !categoryid ||
      !product ||
      !productids ||
      !Array.isArray(productids) ||
      productids.length === 0 ||
      !photo ||
      !userid ||
      !description
    ) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({
          success: false,
          message:"comboname, categoryid,productids (array), description, photo, and userid are required.",
          color: "warning",
        }),
      };
    }

    // 👤 Get user info
    const userResult = await dynamoDb.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { id: userid },
      })
    );

    const userName = userResult.Item?.name || "Unknown User";

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

    // 🖼️ Upload Combo Photo to S3
    let photoUrl = null;
    try {
      const { base64, name, type } = photo;

      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/webp",
      ];
      if (!allowedTypes.includes(type)) {
        return {
          statusCode: 400,
          headers: generateHeaders(),
          body: JSON.stringify({success: false, message: "Only JPEG, PNG, JPG, or WEBP images are allowed", color: "warning",}),
        };
      }

      const buffer = Buffer.from(base64, "base64");
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
      console.error("Error uploading combo photo:", uploadError);
      throw new Error("Failed to upload combo photo");
    }

    // 🗃️ Prepare Combo Data
    const createdtime = new Date().toISOString();
    const productid = Date.now().toString();

    const comboData = {
      productid,
      productname: product ,
      categoryid,
      categoryname,
      productids, // array
      description,
      foodtype,
      price,
      type: 'combo',
      photo: photoUrl,
      createdBy: userName, 
      createdtime,
      flag:true,
    };

    // 💾 Save to DynamoDB
    await dynamoDb.send(
      new PutCommand({
        TableName: PRODUCT_TABLE,
        Item: comboData,
      })
    );

    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({ success: true, message: "Combo added successfully",color: "success", data: comboData, }),
    };
  } catch (error) {
    console.error("Error in addcombo:", error);
    await logError(PRODUCT_TABLE, "addcombo", error.message, null);

    return {
      statusCode: 500,
      headers: generateHeaders(),
      body: JSON.stringify({ success: false, message: "Error adding combo", color: "warning", data: error.message,
      }),
    };
  }
};
