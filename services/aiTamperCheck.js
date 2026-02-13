const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const checkTampering = async (filePath) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const imageBuffer = fs.readFileSync(filePath);

  const result = await model.generateContent([
`You are a document verification AI.

Analyze this document image carefully.

Tasks:
1. Identify the document type: Aadhaar or PAN or Unknown.
2. Detect if the document appears tampered or edited.
3. Extract the document number:
   - Aadhaar → 12 digit number
   - PAN → 10 character alphanumeric
4. Give a confidence score between 0 and 1.
5. Provide a short reason.

Respond ONLY in valid JSON format. Do not add explanations or markdown.

Expected format:
{
  "documentType": "aadhaar" OR "pan" OR "unknown",
  "tampered": true or false,
  "confidence": number,
  "extractedNumber": "string or null",
  "reason": "short reason"
}
`,
{
  inlineData: {
    mimeType: "image/jpeg",
    data: imageBuffer.toString("base64"),
  },
}
]);

  return result.response.text();
};

module.exports = checkTampering;
