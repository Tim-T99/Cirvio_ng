import 'dotenv/config'
import app from "./app";

const PORT = Number(process.env.PORT) || 4000;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[server] Cirvio API running on port ${PORT} — ${process.env.NODE_ENV ?? "development"}`);
  });
}

export default app;
