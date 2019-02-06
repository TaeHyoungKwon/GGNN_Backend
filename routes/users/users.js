const router = require("express").Router();
var mysql = require("mysql");
var dbconfig = require("../../config/database");
var conn = mysql.createConnection(dbconfig);
var util = require("../../util");
const ctrl = require("./users.ctrl");
var _fcm = require("../fcm");
const Sentry = require("@sentry/node");
const winston = require("winston");
const fs = require("fs");
// const logDir = "~/workspce";

// if (!fs.existsSync(logDir)) {
//   fs.mkdirSync(logDir);
// }

const tsFormat = () => new Date().toLocaleTimeString();

// const logger = winston.createLogger({
//   level: "info",
//   format: winston.format.json(),
//   defaultMeta: { service: "user-service" },
//   transports: [
//     new winston.transports.Console(),
//     new winston.transports.File({
//       filename: `${logDir}/logs.log`
//     })
//   ]
// });

// image 업로드 관련 module
var multer = require("multer");
var multerS3 = require("multer-s3");

var path = require("path");
var AWS = require("aws-sdk");

//AWS image 서버 접속 정보
AWS.config.loadFromPath(__dirname + "/../config/awsconfig.json");

let s3 = new AWS.S3();

//파일 업로드 관련 세팅하는 부분
let upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: "gogonono/users",
    key: function(req, file, cb) {
      cb(null, Date.now().toString() + "_" + file.originalname); //파일 명 정하는 부분
    },
    acl: "public-read-write",
  }),
});

conn.connect();

// 이메일 중복 검사
router.get("/check/:email", ctrl.checkDuplication);

// 회원가입
router.post("/", ctrl.singUp);

// 이미지 업데이트
router.put("/:email", upload.single("image"), ctrl.updateImage);

//회원정보 불러오기
router.get("/:userId", ctrl.getUserInfo);

// 회원 deviceToken 확인
router.post("/devicetoken/:email", ctrl.confirmDeviceToken);

module.exports = router;
