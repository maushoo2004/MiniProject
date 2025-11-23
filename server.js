/**
 * Backend Proxy Server for Hugging Face API
 *
 * This server proxies requests to Hugging Face API to avoid CORS issues.
 * Run this server on port 3001 alongside your React app.
 */

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Backend proxy server is running" });
});

/**
 * Proxy endpoint for Hugging Face moderation (toxic-bert)
 */
app.post("/api/moderation", async (req, res) => {
  try {
    const { text, apiKey } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    if (!apiKey) {
      return res.status(400).json({ error: "API key is required" });
    }

    console.log("🔍 Proxying moderation request to Hugging Face");

    // Try multiple endpoint formats - try router with /hf-inference path first
    // Note: Router endpoint may require different authentication or format
    const endpoints = [
      "https://router.huggingface.co/hf-inference/models/unitary/toxic-bert",
      "https://router.huggingface.co/models/unitary/toxic-bert",
      // Try alternative models that might work
      "https://router.huggingface.co/hf-inference/models/unitary/unbiased-toxic-roberta",
      "https://api-inference.huggingface.co/models/unitary/toxic-bert", // Fallback (deprecated)
    ];

    let response;
    let lastError;
    let workingEndpoint;

    for (const hfUrl of endpoints) {
      try {
        console.log(`🔄 Trying endpoint: ${hfUrl}`);
        response = await fetch(hfUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            inputs: text,
          }),
        });

        if (response.ok || response.status === 503) {
          workingEndpoint = hfUrl;
          console.log(`✅ Found working endpoint: ${hfUrl}`);
          break; // Success or model loading
        }

        // Clone response to read error text without consuming body
        const responseClone = response.clone();
        const errorText = await responseClone.text();
        console.warn(
          `❌ Endpoint ${hfUrl} failed:`,
          response.status,
          errorText.substring(0, 100)
        );
        lastError = {
          status: response.status,
          error: errorText.substring(0, 200),
        };
      } catch (error) {
        console.warn(`❌ Endpoint ${hfUrl} error:`, error.message);
        lastError = { status: 0, error: error.message };
        continue;
      }
    }

    if (!response || (!response.ok && response.status !== 503)) {
      console.error(
        "❌ All endpoints failed, falling back to keyword moderation"
      );
      return res.status(500).json({
        error: "All Hugging Face endpoints failed",
        details: lastError,
        fallback: "keyword",
      });
    }

    if (response.status === 503) {
      // Model is loading, wait and retry once
      console.log("⏳ Model is loading, waiting 5 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Use the same endpoint that worked (or first one)
      const retryUrl = workingEndpoint || endpoints[0];
      const retryResponse = await fetch(retryUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          inputs: text,
        }),
      });

      if (!retryResponse.ok) {
        const errorText = await retryResponse.text();
        console.warn("❌ HF retry failed:", retryResponse.status, errorText);
        return res.status(retryResponse.status).json({ error: errorText });
      }

      const retryData = await retryResponse.json();
      console.log("✅ HF Moderation response received");
      return res.json(retryData);
    }

    // Response should be ok or 503 at this point (handled in loop above)
    if (!response.ok && response.status !== 503) {
      // This shouldn't happen, but handle it
      const errorText = await response.text();
      console.warn("❌ Unexpected HF API error:", response.status, errorText);
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    console.log("✅ HF Moderation response received");
    res.json(data);
  } catch (error) {
    console.error("❌ Proxy error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Proxy endpoint for AI rephrasing using Groq AI (Llama models)
 */
app.post("/api/rephrase", async (req, res) => {
  try {
    const { text, apiKey, isHindi } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    if (!apiKey) {
      return res.status(400).json({ error: "API key is required" });
    }

    console.log("💡 Proxying rephrasing request to Groq AI");

    // Create instruction prompt for Groq AI (Llama models)
    const systemPrompt = isHindi
      ? "आप एक सहायक हैं जो आपत्तिजनक टिप्पणियों को सुरक्षित, विनम्र और व्याकरणिक रूप से सही विकल्पों में बदलते हैं। मूल अर्थ को पूरी तरह से बनाए रखने की आवश्यकता नहीं है, बस इसे सुरक्षित और सम्मानजनक बनाएं। केवल पुनर्लेखित संस्करण दें, कोई स्पष्टीकरण नहीं।"
      : "You are a helpful assistant that rephrases offensive comments into safe, polite, and grammatically correct alternatives. You don't need to preserve the exact meaning - just make it safe, respectful, and non-flaggable. Only provide the rephrased version, no explanations or additional text.";

    const userPrompt = isHindi
      ? `कृपया निम्नलिखित टिप्पणी को सुरक्षित और विनम्र तरीके से पुनर्लेखित करें (मूल अर्थ को पूरी तरह से बनाए रखने की आवश्यकता नहीं है): "${text}"`
      : `Rephrase this comment to be safe, polite, and respectful. You don't need to keep the exact same meaning - just make it non-offensive: "${text}"`;

    // Groq API endpoint (OpenAI-compatible)
    const groqUrl = "https://api.groq.com/openai/v1/chat/completions";

    // Try multiple Groq models (fastest first)
    const models = [
      "llama-3.1-8b-instant", // Fastest, good quality
      "llama-3.1-70b-versatile", // Best quality, slightly slower
      "mixtral-8x7b-32768", // Alternative option
    ];

    let response;
    let lastError;

    for (const model of models) {
      try {
        console.log(`🔄 Trying Groq model: ${model}`);
        response = await fetch(groqUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: userPrompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 150,
            top_p: 0.9,
          }),
        });

        if (response.ok) {
          console.log(`✅ Groq API response received (model: ${model})`);
          break; // Success
        }

        // Clone response to read error text without consuming body
        const responseClone = response.clone();
        const errorText = await responseClone.text();
        console.warn(
          `❌ Groq model ${model} failed:`,
          response.status,
          errorText.substring(0, 100)
        );
        lastError = {
          status: response.status,
          error: errorText.substring(0, 200),
        };
      } catch (error) {
        console.warn(`❌ Groq model ${model} error:`, error.message);
        lastError = { status: 0, error: error.message };
        continue;
      }
    }

    if (!response || !response.ok) {
      console.error("❌ All Groq models failed, will use fallback suggestion");
      return res.status(500).json({
        error: "All Groq AI models failed",
        details: lastError,
        fallback: "simple",
      });
    }

    // Parse Groq response (OpenAI-compatible format)
    const data = await response.json();

    if (data.choices && data.choices[0] && data.choices[0].message) {
      const rephrasedText = data.choices[0].message.content.trim();
      console.log("✅ Groq rephrasing successful");

      // Return in a format compatible with the frontend
      return res.json({
        generated_text: rephrasedText,
        model: data.model || "groq-llama",
      });
    }

    // If response format is unexpected, return error
    console.warn("❌ Unexpected Groq response format:", data);
    return res.status(500).json({
      error: "Unexpected response format from Groq API",
      data: data,
    });
  } catch (error) {
    console.error("❌ Proxy error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend proxy server running on http://localhost:${PORT}`);
  console.log(`📡 Ready to proxy Hugging Face API requests`);
});
