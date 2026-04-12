const https = require("https");

function makeRequest(endpoint, params = "") {
  return new Promise((resolve, reject) => {
    const req = https.get(
      `${endpoint}?api_key=${process.env.CRON_API_KEY}${params}`,
      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          resolve(data);
        });
      },
    );

    req.on("error", (e) => {
      reject(e);
    });

    req.end();
  });
}

exports.cronEveryDayAtSixPm = async (event, context) => {
  const time = new Date();
  console.log(`Your cron function "${context.functionName}" ran at ${time}`);
  const cronExample = process.env.CRON_API_BASE_URL + `cron/test`;

  try {
    await makeRequest(cronExample);
  } catch (err) {
    console.log("Cron every day at six PM error:", err);
  }
};

exports.rate1hours = async (event, context) => {
  const time = new Date();
  console.log(`Your cron function "${context.functionName}" ran at ${time}`);
  const cronExample = process.env.CRON_API_BASE_URL + `cron/test`;

  try {
    await makeRequest(cronExample);
  } catch (err) {
    console.log("Cron rate 1 hour error:", err);
  }
};
