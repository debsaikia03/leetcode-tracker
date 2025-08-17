// API endpoint that cron-job.org will call
app.get("/fetch-now", async (req, res) => {
  try {
    // ✅ Token protection
    if (req.query.token !== process.env.CRON_TOKEN) {
      return res.status(403).json({ error: "Forbidden: invalid token" });
    }

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
