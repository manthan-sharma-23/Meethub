# MeetHub

MeetHub is a robust and scalable video conferencing application that allows users to create and join virtual conference rooms. Users can engage in video, audio, and text chats seamlessly within these rooms.

## Features

- **Create and Join Rooms:** Users can easily create or join existing video conference rooms.
- **Video Chat:** High-quality video communication.
- **Audio Chat:** Clear and reliable audio communication.
- **Text Chat:** Integrated text chat within the conference rooms.

## Tech Stack

- **Frontend:** React
- **Server:** Socket.io, Express, Redis (for Pub/Sub)
- **WebRTC:** Built on top of Mediasoup

## Running the Project

### Using Docker

You can easily run the project using Docker Compose.

1. Ensure you have [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed.
2. In the project root directory, run:
   ```bash
   docker-compose up
   ```

### Manual Setup

For a manual setup, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/manthan-sharma-23/Meethub.git
   cd meethub
   ```
2. **Setup the client :**

   ```bash
   cd client
   npm install
   npm run dev
   ```

3. **Setup the server:**

   ```bash
   cd server
   npm install
   npm run dev

   ```

Your project should be live at http://localhost:8080
