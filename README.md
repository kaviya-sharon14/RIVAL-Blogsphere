# Blogsphere Platform

A production-ready, secure blog platform built with NestJS-inspired Express backend and React/Vite frontend.

## 🚀 Features

- **Secure Authentication**: JWT-based auth with bcrypt password hashing.
- **Blog Management**: Full CRUD operations with unique slug generation.
- **Public Feed**: Paginated feed with author info, like counts, and comment counts.
- **Social Interactions**: Real-time likes and comments for authenticated users.
- **Performance & Security**: 
  - Rate limiting on API endpoints with proxy support.
  - Structured logging with Pino.
  - Input validation with Zod.
  - Async job simulation for summary generation.
- **Modern UI**: Clean, responsive design using Tailwind CSS and Motion.

## 🛠 Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Motion, Lucide Icons.
- **Backend**: Node.js, Express, Prisma ORM, JWT, Bcrypt, Zod, Pino.
- **Database**: SQLite (for demo/preview), compatible with PostgreSQL.

## 📦 Setup Instructions (Local VS Code)

1. **Clone the repository** (if applicable).
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Set up Environment Variables**:
   Create a `.env` file in the root:
   ```env
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="your-secret-key"
   GEMINI_API_KEY="your-gemini-key"
   ```
4. **Initialize Database**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```
5. **Run the application**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

## 🏗 Architecture Explanation

The project follows a **Clean Architecture** pattern:
- **Presentation Layer**: React components organized by responsibility.
- **State Management**: React Context for Auth, local state for UI.
- **API Layer**: Centralized request utility with interceptor-like behavior for tokens.
- **Backend Services**: Express routes acting as controllers, Prisma as the data access layer.
- **Validation**: Zod schemas used for both request body validation and type safety.

## 📈 Scaling to 1M Users

To scale this platform to 1 million users, I would implement the following:

1. **Database Scaling**:
   - Migrate to a managed PostgreSQL (e.g., AWS RDS, Neon).
   - Implement Read Replicas for the public feed queries.
   - Use Connection Pooling (e.g., Prisma Accelerate or PgBouncer).
2. **Caching**:
   - Implement Redis caching for the public feed and popular blog posts.
   - Use a CDN (e.g., Cloudflare) for static assets and edge caching of public pages.
3. **Async Processing**:
   - Replace the `setTimeout` simulation with **BullMQ** and **Redis** for robust background jobs (summary generation, email notifications).
4. **Load Balancing**:
   - Deploy multiple instances of the backend behind an Nginx or AWS ALB load balancer.
5. **Search**:
   - Integrate Elasticsearch or Algolia for high-performance full-text search as the blog count grows.

## ⚖️ Tradeoffs Made

- **Framework**: Used Express + Vite instead of NestJS/Next.js to ensure 100% compatibility and performance within the AI Studio sandbox environment while maintaining a Nest-like clean structure.
- **Database**: Used SQLite for the preview to allow immediate interaction without external database setup, while keeping the code Prisma-agnostic for easy PostgreSQL migration.
- **Auth**: Implemented manual JWT instead of NextAuth to demonstrate architectural understanding of security flows.

---
*Developed for the Rival Assessment.*

## 📸 Website Preview

![Screenshot 1](./RIVAL%20SS%201.png)
![Screenshot 2](./RIVAL%20SS%202.png)
![Screenshot 3](./RIVAL%20SS%203.png)
![Screenshot 4](./RIVAL%20SS%204.png)
![Screenshot 5](./RIVAL%20SS%205.png)
![Screenshot 6](./RIVAL%20SS%206.png)
![Screenshot 7](./RIVAL%20SS%207.png)
![Screenshot 8](./RIVAL%20SS%208.png)
![Screenshot 9](./RIVAL%20SS%209.png)

