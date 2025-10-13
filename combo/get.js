const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { generateHeaders, logError } = require("../utils/utils");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDB = DynamoDBDocumentClient.from(client);

const COMBO_TABLE = process.env.COMBO_TABLE; // ⚡ Make sure to define this in serverless.yml

module.exports.getallcombo = async (event) => {
  try {

    //  Fetch all combos from DynamoDB
    const params = new ScanCommand({
      TableName: COMBO_TABLE,
    });

    const data = await dynamoDB.send(params);
    const items = data.Items || [];

    //  Sort alphabetically by Combo Name
    const sortedCombos = items.sort((a, b) =>
      (a.comboname || "").toLowerCase().localeCompare((b.comboname || "").toLowerCase())
    );

    return {
      statusCode: 200,
      headers: generateHeaders(),
      body: JSON.stringify({
        success: true,
        message: "Fetched all combos successfully",
        data: sortedCombos,
        color: "success",
      }),
    };
  } catch (error) {
    console.error("Error fetching combos:", error);

    await logError(COMBO_TABLE, "getallcombo", error.message, null);

    return {
      statusCode: 500,
      headers: generateHeaders(),
      body: JSON.stringify({
        success: false,
        message: "Error fetching combos",
        color: "warning",
        data: error.message,
      }),
    };
  }
};
