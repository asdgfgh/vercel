import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

const logDir = path.join(__dirname, 'logs');
const logFile = path.join(logDir, 'user_actions.log');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

app.use(express.json());

app.post('/api/log', (req, res) => {
  const { event, details } = req.body;
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - Event: ${event}, Details: ${JSON.stringify(details) || ''}\n`;

  fs.appendFile(logFile, logMessage, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
      return res.status(500).send('Failed to log event.');
    }
    res.status(200).send('Event logged.');
  });
});

async function startServer() {
  // --- SERVE FRONTEND ---
  if (process.env.NODE_ENV === 'production') {
    // Serve built static files
    app.use(express.static(path.resolve(__dirname, 'dist')));
    // Fallback for client-side routing
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Use Vite middleware for development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
