const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { generateHeaders, logError } = require("../utils/utils");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDB = DynamoDBDocumentClient.from(client);

const PRODUCT_TABLE = process.env.PRODUCT_TABLE;

module.exports.getallproduct = async (event) => {
  try {

    //  Fetch all categories from DynamoDB
    const params = new ScanCommand({
      TableName: PRODUCT_TABLE,
    });

    const data = await dynamoDB.send(params);
     const items = data.Items || [];

    //  Sort alphabetically by productname
    const sortedProducts = items.sort((a, b) =>
      (a.productname || "").toLowerCase().localeCompare((b.productname || "").toLowerCase())
    );

    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({ success: true, message: "Fetched all products successfully", data: sortedProducts, color: "success", }),
    };
  } catch (error) {
    console.error("Error fetching products:", error);

    await logError(PRODUCT_TABLE, "getallproduct", error.message, null);

    return {
      statusCode: 500,
      headers: generateHeaders(),
      body: JSON.stringify({ success: false, message: "Error fetching products", color: "warning", data: error.message,}),
    };
  }
};
