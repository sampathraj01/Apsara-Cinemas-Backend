const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { generateHeaders, verifyAppToken, logError } = require("../utils/utils");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCT_TABLE;

module.exports.updateStockStatus = async (event) => {
  try {
    // 🔒 Verify JWT token
    const tokenString = event.headers?.Authorization || event.headers?.authorization;
    const verifiedUser = await verifyAppToken(tokenString);

    if (!verifiedUser) {
      return {
        statusCode: 403,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false, message: "Unauthorized user. Invalid token.", color: "warning" }),
      };
    }

    // 🧾 Get productid from path and flag from body
    const { productid } = event.pathParameters || {};
    if (!productid) {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false, message: "productid is required in path", color: "warning" }),
      };
    }

    const { flag } = JSON.parse(event.body || "{}");
    if (typeof flag !== "boolean") {
      return {
        statusCode: 400,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false, message: "flag (boolean) is required", color: "warning" }),
      };
    }

    // ✅ Check if product exists
    const existingProduct = await dynamoDb.send(
      new GetCommand({ TableName: PRODUCTS_TABLE, Key: { productid } })
    );

    if (!existingProduct.Item) {
      return {
        statusCode: 404,
        headers: generateHeaders(),
        body: JSON.stringify({ success: false, message: "Product not found", color: "warning" }),
      };
    }

    // 💾 Update only flag
    const params = {
      TableName: PRODUCTS_TABLE,
      Key: { productid },
      UpdateExpression: "set flag = :flag",  // ✅ removed trailing comma
      ExpressionAttributeValues: { ":flag": flag },
      ReturnValues: "UPDATED_NEW",
    };

    const result = await dynamoDb.send(new UpdateCommand(params));

    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({ success: true, message: "Stock status updated", color: "success", data: result.Attributes }),
    };
  } catch (error) {
    console.error("Error in updateStockStatus:", error);
    await logError(PRODUCTS_TABLE, "updateStockStatus", error.message, null);

    return {
      statusCode: 500,
      headers: generateHeaders(),
      body: JSON.stringify({ success: false, message: "Error updating stock status", color: "warning", data: error.message }),
    };
  }
};
