import express from "npm:express";
import { createServer } from "node:http";
import { Server } from "npm:socket.io";
import cors from "npm:cors";

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// استقبال إحداثيات روبلوكس وبثها لحظياً للموقع
app.post("/api/update-positions", (req, res) => {
  const { positions } = req.body;
  io.emit("positions-updated", positions); // إرسال للموقع مباشرة
  res.json({ success: true });
});

app.get("/", async (req, res) => {
  const html = await Deno.readTextFile("./index.html");
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

const PORT = Deno.env.get("PORT") || 8000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
