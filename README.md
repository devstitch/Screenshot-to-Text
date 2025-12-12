# Screenshot to Text - Next.js OCR Utility

A Next.js 16 application that extracts text from images using OpenAI Vision API and stores results in MongoDB.

## Features

- 📸 Drag & drop image upload
- 🤖 OpenAI Vision API integration for text extraction
- 💾 MongoDB storage for history
- 📜 View and manage extraction history
- 🎨 Modern, responsive UI

## Prerequisites

- Node.js 18+ installed
- MongoDB instance (local or Atlas)
- OpenAI API key

## Installation

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

Create a `.env.local` file in the root directory:

### For Local MongoDB:

```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=screenshots
OPENAI_API_KEY=sk-your-api-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### For MongoDB Atlas:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net
MONGODB_DB_NAME=screenshots
OPENAI_API_KEY=sk-your-api-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Note:**

- For local MongoDB, make sure MongoDB is running on your machine
- Default MongoDB port is `27017`
- If your MongoDB requires authentication, use: `mongodb://username:password@localhost:27017`
- `MONGODB_DB_NAME` is optional (defaults to "screenshots")

## Running the Application

1. Start the development server:

```bash
npm run dev
```

2. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
/app
  /api
    /ocr          - OCR API endpoint
    /history      - History API endpoint
  /components     - React components
/lib              - Utility functions (MongoDB, OpenAI)
/models           - Database models
/types            - TypeScript interfaces
```

## Usage

1. Upload an image by dragging and dropping or clicking to select
2. Wait for text extraction (powered by OpenAI Vision API)
3. View extracted text and copy to clipboard
4. Check history panel for previous extractions
5. Delete items from history as needed

## Technologies Used

- Next.js 16
- React 19
- TypeScript
- MongoDB
- OpenAI API
- Tailwind CSS
- React Dropzone
- Lucide React Icons
