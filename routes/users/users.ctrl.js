var mysql = require("mysql");
var dbconfig = require("../../config/database");
var conn = mysql.createConnection(dbconfig);
var moment = require("moment");
var _fcm = require("../fcm");
const Sentry = require("@sentry/node");
const winston = require("winston");
const fs = require("fs");

const checkDuplication = function(req, res, next) {
  var email = req.params.email;

  //메일 형식이 올바르지 않을 떄,
  if (email === "" || null || undefined || 0 || NaN) {
    return res.status(400).end();
  }
  if (email.search("@") == -1) {
    return res.status(400).end();
  }

  var duplicateQuery = " select * from Users where Email = ?; ";

  conn.query(duplicateQuery, email, function(err, rows) {
    if (err) {
      logger.error("[이메일 중복검사] DB CONN ERR => " + err);
      Sentry.captureException(new Error("[이메일 중복검사] DB CONN ERR"));
    }

    if (rows.length > 0) {
      res.send({ isDuplicated: 1 }).end();
    } else {
      res.send({ isDuplicated: 0 }).end();
    }
  });
};

const singUp = function(req, res, next) {
  var username = req.body.userName;
  var email = req.body.email;
  var nickname = req.body.nickName;
  var clubname = req.body.clubName;
  var rankname = req.body.rankName;
  var etc = req.body.etc;

  testNull = username && email && nickname && clubname && rankname && etc;

  if (
    testNull == 0 ||
    testNull == "" ||
    testNull == null ||
    testNull == undefined
  ) {
    return res.status(400).end();
  }

  var params = [username, email, nickname, clubname, rankname, etc];
  var userQuery =
    " INSERT INTO Users (UserName, EMail, NickName, ClubName, RankName, RegDate, UpdateDate, ETC, Image, LastLoginDate) " +
    " VALUES (?, ?, ?, ?, ?, NOW(), NOW(), ?, null, NOW());";

  conn.query(userQuery, params, function(err, rows) {
    if (err) {
      logger.error("[회원가입] DB CONN ERR => " + err);
      Sentry.captureException(new Error("[회원가입] DB CONN ERR"));
      res.send(err);
    }

    res.send({ result: rows.affectedRows });
  });
};

const updateImage = function(req, res, next) {
  var email = req.params.email;
  let imgFile = req.file;
  var image = imgFile.location;

  var params = [image, email];
  var updateQuery = " update Users set image = ? where email = ?; ";

  conn.query(updateQuery, params, function(err, rows) {
    if (err) {
      logger.error("[회원가입] DB CONN ERR => " + err);
      Sentry.captureException(new Error("[회원가입] DB CONN ERR"));
      res.send(err);
    }

    res.send({ result: rows.affectedRows });
  });
};

const getUserInfo = function(req, res, next) {
  //userId 숫자인지 체크
  userId = parseInt(req.params.userId, 10);

  if (Number.isNaN(userId)) {
    return res.status(400).end();
  }

  var userQuery = "select * from Users where RawID = ?;";

  conn.query(userQuery, userId, function(err, rows) {
    if (err) {
      logger.error("[회원정보 불러오기] DB CONN ERR => " + err);
      Sentry.captureException(new Error("[회원정보 불러오기] DB CONN ERR"));
      res.send(err);
    }

    if (rows[0] === undefined) {
      return res.status(404).end();
    } else {
      res.send(rows[0]);
    }
  });
};

const confirmDeviceToken = function(req, res, next) {
  var email = req.params.email;
  var devicetoken = req.body.deviceToken;

  var checkQuery =
    " update Users " +
    " set DeviceToken = ? " +
    " where Email = ? and DeviceToken != ?; ";
  var checkParams = [devicetoken, email, devicetoken];

  conn.query(checkQuery, checkParams, function(err, rows) {
    if (err) {
      logger.error("[deviceToken 확인] DB CONN ERR => " + err);
      Sentry.captureException(new Error("[deviceToken 확인] DB CONN ERR"));
      res.send(err);
    }

    res.send({ result: rows.affectedRows });
  });
};

module.exports = {
  checkDuplication: checkDuplication,
  singUp: singUp,
  updateImage: updateImage,
  getUserInfo: getUserInfo,
  confirmDeviceToken: confirmDeviceToken,
};
