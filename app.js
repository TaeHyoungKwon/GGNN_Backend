// linux, Mac os Terminal에서 모드 설정
// > export NODE_ENV=production
// > export NODE_ENV=development
// Windows
// > set NODE_ENV=production
process.env.NODE_ENV =
  process.env.NODE_ENV &&
  process.env.NODE_ENV.trim().toLowerCase() == "production"
    ? "production"
    : "development";

var express = require("express");
var YAML = require("yamljs");
var swaggerUi = require("swagger-ui-express");
var swaggerDocument = YAML.load("./swagger.yaml");
var bodyParser = require("body-parser");
var app = express();

const Sentry = require("@sentry/node");
Sentry.init({
  dsn: "https://9b80e89297df43b88cb042645be50c73@sentry.io/1311612",
});

app.use("/s3", require("./routes/s3"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "content-type, x-access-token"); //1
  next();
});

app.set("port", 3000);

app.get("/", function(req, res) {
  res.send("GOGONONO API SERVER!!!!");
});

// 모임 관련 api
app.use("/api", require("./routes/groups/groups"));

// 유저 관련 api
app.use("/users", require("./routes/users/users"));

app.listen(app.get("port"), function() {
  console.log("gogonono express server listening on port " + app.get("port"));
});

module.exports = app;
