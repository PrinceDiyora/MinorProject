import app from "./app.js";
import connectDB from "./db/index.js";
import { scheduleNightlyPricing } from "./jobs/nightly_pricing.job.js";

const PORT = process.env.PORT || 8000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`⚡️ Server is running at port : ${PORT}`);
      scheduleNightlyPricing();
    });
  })
  .catch((err) => {
    console.log("MONGO db connection failed !!! ", err);
  });

