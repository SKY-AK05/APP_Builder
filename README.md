# AI App Forge

AI App Forge is a powerful and intuitive web application built with Next.js that allows you to generate complete Flutter applications simply by describing them in natural language. It leverages the power of Generative AI to turn your ideas into production-ready Flutter code.

## ✨ Features

- **Conversational App Generation:** Describe the app you want to build, and our AI will generate the Flutter code for you.
- **Full Project Generation:** The AI provides a complete, syntactically correct Flutter project, including `pubspec.yaml` for dependencies and `main.dart` for the application logic.
- **AI-Powered Requirement Analysis:** An intelligent agent first analyzes your request to ensure it's specific enough for high-quality results.
- **Live Preview Ready:** The frontend is designed to integrate with a Flutter build service to show a live, interactive preview of your generated app (requires manual backend setup).
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

To enable the live, interactive preview feature, you need to build and deploy a separate backend service. The frontend is designed to interact with this service but does not include it.

Here is what you need to create manually:

1.  **Flutter Build Service (API Endpoint)**
    -   **URL:** `POST https://<your-server>/api/flutter-build`
    -   **Functionality:** This endpoint must accept a `.zip` file containing the generated Flutter source code (`main.dart`, `pubspec.yaml`).
    -   **Process:**
        -   It receives and unzips the project files.
        -   It runs the `flutter build web` command using an installed Flutter SDK.
        -   It stores the compiled web app artifacts (the contents of the `build/web` directory).
    -   **Response:** It must return a unique `buildId` in a JSON object (e.g., `{ "buildId": "xyz-123" }`). This ID is used to track the build and access the logs/preview.

2.  **Log Streaming Service (WebSocket)**
    -   **URL:** `wss://<your-server>/logs/<buildId>`
    -   **Functionality:** This WebSocket server should stream the real-time console output from the `flutter build web` command to the connected frontend client. This allows the user to see the build progress live.

3.  **Static Hosting for Previews**
    -   **Functionality:** You need a service (like a CDN or static file server) to host the compiled Flutter web app.
    -   **URL Structure:** The final, runnable app should be accessible at a URL that includes the `buildId`, for example: `https://<your-cdn>/<buildId>/index.html`.

Once these backend services are running, you can update the frontend code in `src/app/build/page.tsx` to make the necessary API calls and enable the full interactive preview experience.

## Getting Started

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
