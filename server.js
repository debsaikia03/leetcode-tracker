// server.js
import express from "express";
import mongoose from "mongoose";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// MongoDB connection
await mongoose.connect(process.env.MONGO_URI);

const dailySchema = new mongoose.Schema({
  username: String,
  date: { type: Date, default: Date.now },
  problems: [String],
});

const DailyProblems = mongoose.model("DailyProblems", dailySchema);

// Fetch recent accepted submissions
async function fetchRecentAccepted(username) {
  const query = `
    query {
      recentAcSubmissionList(username: "${username}", limit: 50) {
        id
        title
        timestamp
      }
    }
  `;

  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  const data = await res.json();
  return data.data.recentAcSubmissionList;
}

// API endpoint that cron-job.org will call
app.get("/fetch-now", async (req, res) => {
  try {
    const username = process.env.LEETCODE_USERNAME;
    const submissions = await fetchRecentAccepted(username);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayProblems = submissions.filter((s) => {
      const solvedDate = new Date(s.timestamp * 1000);
      solvedDate.setHours(0, 0, 0, 0);
      return solvedDate.getTime() === today.getTime();
    });

    const uniqueNames = [...new Set(todayProblems.map((s) => s.title))];

    if (uniqueNames.length > 0) {
      const record = new DailyProblems({
        username,
        date: today,
        problems: uniqueNames,
      });
      await record.save();
      console.log("✅ Stored daily problems:", uniqueNames);
      res.json({ status: "saved", problems: uniqueNames });
    } else {
      console.log("ℹ️ No problems solved today.");
      res.json({ status: "none", message: "No problems solved today." });
    }
  } catch (err) {
    console.error("❌ Error fetching submissions:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Root endpoint
app.get("/", (req, res) => {
  res.send("🚀 LeetCode Tracker is running. Use /fetch-now to trigger save.");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌍 Server running on port ${PORT}`);
});
