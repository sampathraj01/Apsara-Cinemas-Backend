const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { generateHeaders, logError } = require("../utils/utils");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDB = DynamoDBDocumentClient.from(client);

const CATEGORY_TABLE = process.env.CATEGORY_TABLE;

module.exports.getallcategory = async (event) => {
  try {

    //  Fetch all categories from DynamoDB
    const params = new ScanCommand({
      TableName: CATEGORY_TABLE,
    });

    const data = await dynamoDB.send(params);

    //  Sort categories alphabetically by 'categoryname' (case-insensitive)
    const sortedCategories = (data.Items || []).sort((a, b) =>
      a.categoryname.toLowerCase().localeCompare(b.categoryname.toLowerCase())
    );

    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({ success: true, message: "Fetched all categories successfully", data: sortedCategories, color: "success", }),
    };
  } catch (error) {
    console.error("Error fetching categories:", error);

    await logError(CATEGORY_TABLE, "getallcategory", error.message, null);

    return {
      statusCode: 500,
      headers: generateHeaders(),
      body: JSON.stringify({ success: false, message: "Error fetching categories", color: "warning", data: error.message,}),
    };
  }
};
