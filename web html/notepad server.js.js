const express = require("express");

const app = express();
app.use(express.json());

// CORS (permite conectar tu web)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

app.post("/chat", async (req, res) => {
  try {
    const message = req.body.message;

    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3",
        messages: [
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();

    res.json({
      reply: data.message.content
    });

  } catch (err) {
    res.json({ reply: "Error conectando con la IA" });
  }
});

app.listen(3000, () => {
  console.log("🚀 Chat listo en http://localhost:3000");
});