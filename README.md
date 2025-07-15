# AI App Forge

AI App Forge is a powerful and intuitive web application built with Next.js that allows you to generate complete Flutter applications simply by describing them in natural language. It leverages the power of Generative AI to turn your ideas into production-ready Flutter code.

## ✨ Features

- **Conversational App Generation:** Describe the app you want to build, and our AI will generate the Flutter code for you.
- **Full Project Generation:** The AI provides a complete, syntactically correct Flutter project, including `pubspec.yaml` for dependencies and `main.dart` for the application logic.
- **AI-Powered Requirement Analysis:** An intelligent agent first analyzes your request to ensure it's specific enough for high-quality results.
- **Live Preview Ready:** The frontend is designed to integrate with a Flutter build service to show a live, interactive preview of your generated app.
- **Modern Tech Stack:** Built with Next.js, React, and ShadCN UI for a sleek and responsive user experience.

## 🚀 Tech Stack

- **Frontend:** Next.js, React, TypeScript
- **Styling:** Tailwind CSS, ShadCN UI
- **Generative AI:** Google Gemini via Genkit
- **State Management:** React Hooks & Context

## 📁 Project Structure

Here is an overview of the key directories and files in this project:

```
.
├── src
│   ├── app/                # Next.js App Router pages (UI)
│   │   ├── build/page.tsx  # The main app builder UI
│   │   └── page.tsx        # The landing page
│   │
│   ├── ai/                 # All AI-related code
│   │   ├── flows/          # Genkit flows that define AI logic
│   │   └── genkit.ts       # Genkit client initialization
│   │
│   ├── components/         # Reusable React components
│   │   ├── ui/             # ShadCN UI components
│   │   └── landing/        # Components specific to the landing page
│   │
│   ├── hooks/              # Custom React hooks
│   └── lib/                # Utility functions
│
├── next.config.ts          # Next.js configuration
├── tailwind.config.ts      # Tailwind CSS configuration
└── tsconfig.json           # TypeScript configuration
```

## 🛠️ Manual Setup for Live Previews

To enable the live, interactive preview feature, you need to build and deploy a separate backend service. The frontend is designed to interact with this service but does not include it. Below is a recommended implementation guide using Node.js and Express.

### Backend Requirements

1.  **Accepts Zipped Project:** Receives a Flutter project and builds it.
2.  **Live Log Streaming:** Streams build logs via WebSocket.
3.  **Host Built App:** Hosts the final web app at a unique URL.

### Recommended Tech Stack

- **Backend Framework:** Node.js with Express
- **WebSocket:** `ws` library
- **File System:** `multer` for uploads, `unzipper` for decompression
- **Build System:** Must have the Flutter SDK installed and available in the system's PATH.

### Backend Implementation Guide (Node.js/Express)

Here is a high-level plan for your backend server.

**1. Project Setup:**

```bash
mkdir flutter-build-server
cd flutter-build-server
npm init -y
npm install express cors multer unzipper ws fs-extra
```

**2. Server Code (`server.js`):**

Create a `server.js` file and add the following code. This example provides the core logic.

```javascript
// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const multer = 'multer';
const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/logs' });

const BUILDS_DIR = path.join(__dirname, 'builds');
fs.ensureDirSync(BUILDS_DIR);

app.use(require('cors')());
app.use('/builds', express.static(BUILDS_DIR));

const upload = multer({ storage: multer.memoryStorage() });

// 1. API Endpoint for starting a build
app.post('/api/flutter-build', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const buildId = uuidv4();
    const buildPath = path.join(BUILDS_DIR, buildId);
    const projectPath = path.join(buildPath, 'project');
    const logPath = path.join(buildPath, 'build.log');

    try {
        await fs.ensureDir(projectPath);
        await fs.writeFile(logPath, ''); // Create empty log file

        // Unzip the project
        const zip = new require('unzipper').Parse();
        zip.on('entry', (entry) => {
            const filePath = path.join(projectPath, entry.path);
            entry.pipe(fs.createWriteStream(filePath));
        });
        zip.write(req.file.buffer);
        zip.end();
        
        console.log(`[${buildId}] Project unzipped to ${projectPath}`);
        
        // Spawn the flutter build process
        const buildProcess = spawn('flutter', ['build', 'web', '--release'], { cwd: projectPath });

        const logStream = fs.createWriteStream(logPath, { flags: 'a' });

        buildProcess.stdout.on('data', (data) => {
            logStream.write(data);
            broadcastLog(buildId, data.toString());
        });

        buildProcess.stderr.on('data', (data) => {
            logStream.write(data);
            broadcastLog(buildId, `ERROR: ${data.toString()}`);
        });

        buildProcess.on('close', (code) => {
            const finalMessage = code === 0 ? 'BUILD_SUCCESS' : 'BUILD_ERROR';
            logStream.write(finalMessage);
            broadcastLog(buildId, finalMessage);
            logStream.end();
            console.log(`[${buildId}] Build finished with code ${code}`);
        });
        
        // Immediately return the buildId
        res.json({ buildId });

    } catch (error) {
        console.error(`[${buildId}] Build failed:`, error);
        res.status(500).json({ error: 'Build failed to start' });
    }
});

// 2. WebSocket for log streaming
const clients = new Map();
wss.on('connection', (ws, req) => {
    const buildId = new URL(req.url, `ws://${req.headers.host}`).searchParams.get('buildId');
    if (!buildId) {
        return ws.close();
    }
    
    if (!clients.has(buildId)) {
        clients.set(buildId, new Set());
    }
    clients.get(buildId).add(ws);

    // Send existing logs on connection
    const logPath = path.join(BUILDS_DIR, buildId, 'build.log');
    if (fs.existsSync(logPath)) {
        ws.send(fs.readFileSync(logPath, 'utf8'));
    }

    ws.on('close', () => {
        clients.get(buildId)?.delete(ws);
    });
});

function broadcastLog(buildId, message) {
    if (clients.has(buildId)) {
        for (const client of clients.get(buildId)) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        }
    }
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Flutter build server listening on port ${PORT}`);
});
```

**3. Running the Backend:**

*   Save the code above as `server.js`.
*   Run `node server.js` from your terminal.

**4. Updating Frontend URL:**

Once your server is running (e.g., at `http://localhost:3001`), update the placeholder URL in `src/app/build/page.tsx` to point to your new backend.

## Getting Started with this Project

To run the frontend application locally:

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Run the development server:**
    ```bash
    npm run dev
    ```

Open [http://localhost:9002](http://localhost:9002) with your browser to see the result.
# APP_Builder
