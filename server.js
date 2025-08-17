// server.js
import mongoose from "mongoose";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

// MongoDB connection
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
}

// Schema: username + date + problem names
const dailySchema = new mongoose.Schema({
  username: { type: String, required: true },
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

// Main function
async function runJob() {
  await connectDB();

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
  } else {
    console.log("ℹ️ No problems solved today.");
  }

  // Close connection after finishing
  mongoose.connection.close();
}

// Run once
runJob();
