const { applyCors, sendJson } = require("../lib/cors-json");

const HF_MODELS = [
  "black-forest-labs/FLUX.1-schnell",
  "stabilityai/stable-diffusion-xl-base-1.0",
  "runwayml/stable-diffusion-v1-5",
];

async function queryModel(model, prompt, seed, token) {
  const response = await fetch(
    `https://router.huggingface.co/hf-inference/models/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { seed },
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HF ${model} failed (${response.status}): ${text}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("base64");
}

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  const token = process.env.HF_TOKEN;
  if (!token) {
    return sendJson(res, 500, { error: "HF_TOKEN is not configured on server." });
  }

  const { prompt, seed = Math.floor(Math.random() * 1000000) } = req.body || {};
  if (!prompt || String(prompt).trim().length < 3) {
    return sendJson(res, 400, { error: "Prompt must be at least 3 characters." });
  }

  const errors = [];
  for (const model of HF_MODELS) {
    try {
      const imageBase64 = await queryModel(model, String(prompt).trim(), seed, token);
      return sendJson(res, 200, { imageBase64, model });
    } catch (error) {
      errors.push(error.message);
    }
  }

  return sendJson(res, 502, { error: "All Hugging Face models failed.", details: errors });
};
