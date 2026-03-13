import express, { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import path from "path";
import { createServer as createViteServer } from "vite";
import rateLimit from "express-rate-limit";
import pino from "pino";

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: { colorize: true },
  },
});

const prisma = new PrismaClient();
const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

// Trust proxy for express-rate-limit
app.set("trust proxy", 1);

app.use(express.json());

// --- Middleware ---

const authenticate = async (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Too many requests, please try again later." },
});

app.use("/api/", apiLimiter);

// --- Auth Routes ---

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = z.object({ email: z.string(), password: z.string() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Blog Routes ---

const blogSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  isPublished: z.boolean().optional(),
});

// Create Blog
app.post("/api/blogs", authenticate, async (req: any, res) => {
  try {
    const { title, content, isPublished } = blogSchema.parse(req.body);
    const slug = title.toLowerCase().replace(/ /g, "-") + "-" + Date.now();
    
    const blog = await prisma.blog.create({
      data: {
        title,
        content,
        slug,
        isPublished: isPublished ?? false,
        userId: req.userId,
      },
    });

    // Async Job Simulation: Generate Summary
    if (blog.isPublished) {
      setTimeout(async () => {
        const summary = blog.content.substring(0, 150) + "...";
        await prisma.blog.update({
          where: { id: blog.id },
          data: { summary },
        });
        logger.info(`Summary generated for blog: ${blog.id}`);
      }, 2000);
    }

    res.status(201).json(blog);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Edit Blog
app.patch("/api/blogs/:id", authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { title, content, isPublished } = blogSchema.partial().parse(req.body);
    
    const blog = await prisma.blog.findUnique({ where: { id } });
    if (!blog) return res.status(404).json({ error: "Blog not found" });
    if (blog.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });

    const updated = await prisma.blog.update({
      where: { id },
      data: { title, content, isPublished },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Blog
app.delete("/api/blogs/:id", authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const blog = await prisma.blog.findUnique({ where: { id } });
    if (!blog) return res.status(404).json({ error: "Blog not found" });
    if (blog.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });

    await prisma.blog.delete({ where: { id } });
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Public Routes ---

// Public Feed
app.get("/api/public/feed", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;

  const blogs = await prisma.blog.findMany({
    where: { isPublished: true },
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
  });

  res.json(blogs);
});

// Public Blog Detail
app.get("/api/public/blogs/:slug", async (req, res) => {
  const { slug } = req.params;
  const blog = await prisma.blog.findUnique({
    where: { slug, isPublished: true },
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });

  if (!blog) return res.status(404).json({ error: "Blog not found" });
  res.json(blog);
});

// --- Social Routes ---

// Like/Unlike
app.post("/api/blogs/:id/like", authenticate, async (req: any, res) => {
  try {
    const { id: blogId } = req.params;
    await prisma.like.upsert({
      where: { userId_blogId: { userId: req.userId, blogId } },
      create: { userId: req.userId, blogId },
      update: {},
    });
    const count = await prisma.like.count({ where: { blogId } });
    res.json({ likes: count });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/blogs/:id/like", authenticate, async (req: any, res) => {
  try {
    const { id: blogId } = req.params;
    await prisma.like.delete({
      where: { userId_blogId: { userId: req.userId, blogId } },
    });
    const count = await prisma.like.count({ where: { blogId } });
    res.json({ likes: count });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Comments
app.post("/api/blogs/:id/comments", authenticate, async (req: any, res) => {
  try {
    const { id: blogId } = req.params;
    const { content } = z.object({ content: z.string().min(1) }).parse(req.body);
    const comment = await prisma.comment.create({
      data: { content, blogId, userId: req.userId },
      include: { user: { select: { name: true } } },
    });
    res.status(201).json(comment);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/blogs/:id/comments", async (req, res) => {
  const { id: blogId } = req.params;
  const comments = await prisma.comment.findMany({
    where: { blogId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(comments);
});

// --- Vite Integration ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
