var mysql = require("mysql");
var dbconfig = require(__dirname + "/../../config/database");
var conn = mysql.createConnection(dbconfig);
const ctrl = require("./groups.ctrl");
var moment = require("moment");
var _fcm = require(__dirname + "/../fcm");
const Sentry = require("@sentry/node");
const winston = require("winston");
const fs = require("fs");
// const logDir = "~/workspace";

// if (!fs.existsSync(logDir)) {
//   fs.mkdirSync(logDir);
// }

let logger;
if (process.env.NODE_ENV === "production") {
  logger = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    defaultMeta: { service: "user-service" },
    // transports: [
    //   new winston.transports.File({
    //     filename: `${logDir}/logs.log`,
    //   }),
    // ],
  });
} else if (process.env.NODE_ENV === "development") {
  logger = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    defaultMeta: { service: "user-service" },
    transports: [new winston.transports.Console()],
  });
}

conn.connect();

// 모임리스트 호출
const GetGroups = function(req, res, next) {
  var email = req.params.email;

  var selectQuery =
    "select u.RawID as 'userId', " +
    "  		 kg.RawID as 'groupId', " +
    "        kg.GroupName as 'groupName', " +
    "        (select count(*) " +
    "        from GroupJoin " +
    "        where GroupID = kg.RawID) as 'groupUserCount', " +
    "        (select count(*) " +
    "        from Votes " +
    "        where GroupID = kg.RawID and IsComplete = 1) as 'completeVotes', " +
    "        (select count(*) " +
    "        from Votes " +
    "        where GroupID = kg.RawID and IsComplete = 0) as 'notCompleteVotes', " +
    "        u.RegDate as 'regDate', " +
    "        u.LastLoginDate as 'lastLoginDate' " +
    "from Users as u " +
    "left outer join GroupJoin as gj on u.RawID = gj.UserID " +
    "left outer join KP_Groups as kg on gj.GroupID = kg.RawID " +
    "left outer join Votes as v on v.GroupID = kg.RawID " +
    "where u.EMail = '" +
    email +
    "' " +
    "group by userId, groupId, groupName, groupUserCount, completeVotes, notCompleteVotes;";

  conn.query(selectQuery, function(err, rows) {
    if (err) {
      logger.error("[로그인 시 모임 리스트 호출] DB ERR => " + err);
      Sentry.captureException(new Error("[로그인 시 모임 리스트 호출] DB ERR"));
      res.send(err);
    }

    logger.info(
      rows[0].userId +
        " " +
        rows[0].regDate +
        " " +
        typeof rows[0].lastLoginDate
    );
    var isfirst;
    if (rows[0].regDate.toString() == rows[0].lastLoginDate.toString()) {
      isfirst = true;
    } else {
      isfirst = false;
    }

    if (rows[0].groupName != null) {
      res.send(groupListResult(isfirst, rows[0].userId, groupListToJson(rows)));
    } else {
      res.send(groupListResult(isfirst, rows[0].userId, null));
    }
  });
};

// 모임 만들기
const CreateGroups = function(req, res, next) {
  var groupname = req.body.groupName;
  var groupcode = req.body.groupCode;
  var userid = req.params.userId;

  var checkquery = "select * from KP_Groups where GroupCode = ?;";
  conn.query(checkquery, groupcode, function(err, rows) {
    if (err) {
      logger.error("[모임 만들기] DB ERR => " + err);
      Sentry.captureException(new Error("[모임 만들기] DB ERR"));
      res.send({ state: "dbConnect fail", err: err });
    }
    if (rows.length > 0) {
      res.send(AddSuccess(false, "중복 코드"));
    } else {
      var groupParams = [groupname, groupcode, userid];
      var insertGroup =
        "INSERT INTO KP_Groups (GroupName, GroupCode, UserID, RegDate, UpdateDate) VALUES ( ?, ?, ?, NOW(), NOW());";

      conn.query(insertGroup, groupParams, function(err, rows) {
        if (err) {
          logger.error("[모임 만들기] DB ERR => " + err);
          Sentry.captureException(new Error("[모임 만들기] DB ERR"));
          res.send({ state: "KP_Groups insert fail", err: err });
        }

        var joinParams = [rows.insertId, userid];
        var insertJoin =
          "INSERT INTO GroupJoin (GroupID, UserID, RegDate, UpdateDate) VALUES (?, ?, NOW(), NOW());";
        conn.query(insertJoin, joinParams, function(err, rows) {
          if (err) {
            logger.error("[모임 만들기] DB ERR => " + err);
            Sentry.captureException(new Error("[모임 만들기] DB ERR"));
            res.send({ state: "GroupJoin insert fail", err: err });
          }

          res.send(AddSuccess(true, "모임 생성 성공"));
        });
      });
    }
  });
};

// 모임 가입
const JoinGroups = function(req, res, next) {
  var userid = req.params.userId;
  var groupcode = req.body.groupCode;

  var checkquery =
    "select * from KP_Groups where GroupCode = '" +
    groupcode +
    "'; " +
    "select * from KP_Groups as kg join GroupJoin as gj on kg.RawID = gj.GroupID where kg.GroupCode = '" +
    groupcode +
    "' and gj.UserID = " +
    userid +
    ";";
  conn.query(checkquery, function(err, rows) {
    if (err) {
      logger.error("[모임 가입] DB ERR => " + err);
      Sentry.captureException(new Error("[모임 가입] DB ERR"));
      res.send({ state: "dbConnect fail", err: err });
    }

    if (rows[0].length > 0 && rows[1].length == 0) {
      // 가입가능
      var groupid = rows[0][0].RawID;

      var joinParams = [groupid, userid];
      var insertJoin =
        "INSERT INTO GroupJoin (GroupID, UserID, RegDate, UpdateDate) VALUES (?, ?, NOW(), NOW());";
      conn.query(insertJoin, joinParams, function(err, rows) {
        if (err) {
          logger.error("[모임 가입] DB ERR => " + err);
          Sentry.captureException(new Error("[모임 가입] DB ERR"));
          res.send({ state: "GroupJoin insert fail", err: err });
        }

        var votejoinParams = [userid, groupid];
        var voetJoin =
          " insert into VoteJoin ( VoteID, IsVoting, UserID, RegDate, UpdateDate ) " +
          " select v.RawID, 0, ?, now(), now() " +
          " from Votes as v " +
          " where v.GroupID = ? and EndDate >= now(); ";

        conn.query(voetJoin, votejoinParams, function(err, rows) {
          if (err) {
            logger.error("[모임 가입] DB ERR => " + err);
            Sentry.captureException(new Error("[모임 가입] DB ERR"));
            res.send({ state: "VoteJoin insert fail", err: err });
          }
        });
        res.send(AddSuccess(true, "가입 성공"));
      });
    } else if (rows[0].length > 0 && rows[1].length > 0) {
      // 중복 가입
      res.send(AddSuccess(false, "모임 중복 가입"));
    } else if (rows[0].length == 0) {
      // 가입 불가
      res.send(AddSuccess(false, "해당 모임 없음"));
    }
  });
};

// 투표 리스트 호출
const GetVotes = function(req, res, next) {
  var groupid = req.params.groupId;
  var userid = req.params.userId;

  var votesParams = [groupid, userid];

  var votesquery =
    " select v.RawID as 'voteId', " +
    " 		case " +
    " 			when v.EndDate > curdate() then 'false' " +
    "             else 'true' " +
    " 		end as 'isExpired', " +
    " 		vj.IsVoting as 'status', " +
    "         v.EndDate as 'voteDueDate', " +
    "         (select count(*) " +
    " 			from VoteJoin " +
    "             where VoteID = v.RawID) as 'allUser', " +
    " 		(select count(*) " +
    " 			from VoteJoin " +
    "             where VoteID = v.RawID and IsVoting <> 0 ) as 'participant', " +
    " 		v.EventDate as 'eventDate', " +
    "         v.VoteName as 'title', " +
    "         su.UserName as 'sponsor' " +
    " from Votes as v " +
    " join VoteJoin as vj on v.RawID = vj.VoteID  " +
    " join KP_Groups as kg on v.GroupID = kg.RawID " +
    " join Users as su on su.RawID = v.UserID " +
    " join Users as pu on pu.RawID = vj.UserID " +
    " where kg.RawID = ? and vj.UserID = ? " +
    " order by v.EventDate desc; ";

  conn.query(votesquery, votesParams, function(err, rows) {
    if (err) {
      logger.error("[투표 리스트 호출] DB ERR => " + err);
      Sentry.captureException(new Error("[투표 리스트 호출] DB ERR"));
      res.send({ state: "Vote list select fail", err: err });
    }

    var today = new Date();
    var endVoteList = [];
    var ingVoteList = [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].voteDueDate >= today) {
        ingVoteList.push(rows[i]);
      } else {
        endVoteList.push(rows[i]);
      }
    }

    res.send(voteListResult(ingVoteList, endVoteList));
  });
};

// 투표 정보 호출
const GetVoteInfo = function(req, res, next) {
  var voteid = req.params.voteId;
  var userid = req.params.userId;

  var infoParams = [voteid, userid];
  var infoQuery =
    " select v.RawID as 'voteId', " +
    " 		case " +
    " 			when v.EndDate > curdate() then 'false' " +
    "             else 'true' " +
    " 		end as 'isExpired', " +
    " 		vj.IsVoting as 'status', " +
    "         v.EndDate as 'voteDueDate', " +
    "         (select count(*) " +
    " 			from VoteJoin " +
    "             where VoteID = v.RawID) as 'allUser', " +
    " 		(select count(*) " +
    " 			from VoteJoin " +
    "             where VoteID = v.RawID and IsVoting <> 0 ) as 'participant', " +
    " 		v.EventDate as 'eventDate', " +
    "         v.VoteName as 'title', " +
    "         su.UserName as 'sponsor' " +
    " from Votes as v " +
    " join VoteJoin as vj on v.RawID = vj.VoteID " +
    " join KP_Groups as kg on v.GroupID = kg.RawID " +
    " join Users as su on su.RawID = v.UserID " +
    " join Users as pu on pu.RawID = vj.UserID " +
    " where v.RawID = ? and vj.UserID = ? " +
    " group by 'voteId', 'isExpired', 'status', 'voteDueDate', 'allUser', 'participant', 'eventDate', 'contents', 'sponsor'; ";

  conn.query(infoQuery, infoParams, function(err, rows) {
    if (err) {
      logger.error("[투표 리스트 투표 정보 호출] DB ERR => " + err);
      Sentry.captureException(new Error("[투표 리스트 투표 정보 호출] DB ERR"));
      res.send({ state: "Vote Info select fail", err: err });
    }

    res.send({
      voteId: rows[0].voteId,
      isExpired: rows[0].isExpired,
      status: rows[0].status,
      voteDueDate: ConvertTimeToDate(rows[0].voteDueDate),
      allUser: rows[0].allUser,
      participant: rows[0].participant,
      eventDate: ConvertTimeToDate(rows[0].eventDate),
      title: rows[0].title,
      sponsor: rows[0].sponsor,
    });
  });
};

// 투표 디테일 정보 호출
const GetVoteDetail = function(req, res, next) {
  var voteid = req.params.voteId;
  var userid = req.params.userId;

  var infoParams = [voteid, userid];
  var infoQuery =
    " select v.RawID as 'voteId', " +
    " 		vj.IsVoting as 'status', " +
    "         (select count(*) " +
    " 			from VoteJoin " +
    "             where VoteID = v.RawID and IsVoting = 1) as 'gogo', " +
    " 		(select count(*) " +
    " 			from VoteJoin " +
    "             where VoteID = v.RawID and IsVoting = 2) as 'nono', " +
    " 		(select count(*) " +
    " 			from VoteJoin " +
    "             where VoteID = v.RawID and IsVoting = 3) as 'ggnn', " +
    " 		(select count(*) " +
    " 			from VoteJoin " +
    "             where VoteID = v.RawID) as 'allUser', " +
    " 		v.RegDate as 'createDate', " +
    "         v.VoteName as 'title', " +
    " 		v.ETC as 'contents', " +
    "         su.UserName as 'sponsor' " +
    " from Votes as v " +
    " join VoteJoin as vj on v.RawID = vj.VoteID " +
    " join KP_Groups as kg on v.GroupID = kg.RawID " +
    " join Users as su on su.RawID = v.UserID " +
    " join Users as pu on pu.RawID = vj.UserID " +
    " where v.RawID = ? and vj.UserID = ? " +
    " group by 'voteId', 'status', 'voteDueDate', 'gogo', 'nono', 'allUser', 'createDate', 'eventDate', 'title', 'contents', 'sponsor'; ";

  conn.query(infoQuery, infoParams, function(err, rows) {
    if (err) {
      logger.error("[투표 디테일 정보 호출] DB ERR => " + err);
      Sentry.captureException(new Error("[투표 디테일 정보 호출] DB ERR"));
      res.send({ state: "Vote Info select fail", err: err });
    }

    res.send({
      voteId: rows[0].voteId,
      status: rows[0].status,
      gogo: rows[0].gogo,
      nono: rows[0].nono,
      ggnn: rows[0].ggnn,
      allUser: rows[0].allUser,
      createDate: ConvertTimeToDate(rows[0].createDate),
      title: rows[0].title,
      contents: rows[0].contents,
      sponsor: rows[0].sponsor,
    });
  });
};

// 투표 하기
const DoVote = function(req, res, next) {
  var voting = req.params.voting;
  var voteid = req.params.voteId;
  var userid = req.params.userId;

  var voteParams = [voting, voteid, userid];
  var votingQuery =
    " update VoteJoin " +
    " set IsVoting = ?," +
    " UpdateDate = NOW()" +
    " where VoteID = ? and UserID = ?";

  conn.query(votingQuery, voteParams, function(err, rows) {
    if (err) {
      logger.error("[투표하기] DB ERR => " + err);
      Sentry.captureException(new Error("[투표하기] DB ERR"));
      res.send({ state: "Vote Info select fail", err: err });
    }

    res.send({ result: rows.changedRows });
  });
};

// 투표 만들기
const CreateVote = function(req, res, next) {
  var votename = req.body.voteName;
  var userid = req.params.userId;
  var groupid = req.params.groupId;
  var etc = req.body.etc;
  var enddate = req.body.endDate;
  var eventdate = req.body.eventDate;

  var voteParams = [votename, userid, groupid, etc, enddate, eventdate];
  var voteQuery =
    " INSERT INTO Votes (VoteName, UserID, GroupID, IsComplete, ETC, EndDate, EventDate, RegDate, UpdateDate) " +
    " VALUES (?, ?, ?, 0, ?, ?, ?, NOW(), NOW()); ";

  conn.query(voteQuery, voteParams, function(err, rows) {
    if (err) {
      logger.error("[투표 만들기] DB ERR => " + err);
      Sentry.captureException(new Error("[투표 만들기] DB ERR"));
      res.send({ state: "dbConnect fail", err: err });
    }

    var voteId = rows.insertId;
    var joinParams = [rows.insertId, groupid];
    var joinQuery =
      " insert into VoteJoin ( VoteID, IsVoting,GroupID, UserID, RegDate, UpdateDate ) " +
      " select ?, 0, g.GroupID, g.UserID, now(), now() " +
      " from GroupJoin as g " +
      " where g.GroupID = ?; ";

    conn.query(joinQuery, joinParams, function(err, rows) {
      if (err) {
        logger.error("[투표 만들기] DB ERR => " + err);
        Sentry.captureException(new Error("[투표 만들기] DB ERR"));
        res.send({ state: "dbConnect fail", err: err });
      }

      SendToFCM(groupid, voteId, votename, etc);
      res.send(AddSuccess(true, "투표 생성 성공"));
    });
  });
};

// 내가 만든 투표
const MyVotes = function(req, res, next) {
  var userid = req.params.userId;

  var infoQuery =
    " select u.UserName as 'userName', " +
    "       u.Image as 'userImage', " +
    "       v.RawID as 'voteID', " +
    "       v.VoteName as 'voteName', " +
    "       kg.RawID as 'groupID', " +
    "       kg.GroupName as 'groupName' " +
    " from Users as u " +
    " left outer join Votes as v on ( u.RawID = v.UserID && v.EndDate >= now() ) " +
    " left outer join KP_Groups as kg on kg.RawID = v.GroupID " +
    " where u.RawID = ? ; ";
  var infoParams = [userid];

  conn.query(infoQuery, infoParams, function(err, rows) {
    if (err) {
      logger.error("[내가 만든 투표] DB ERR => " + err);
      Sentry.captureException(new Error("[내가 만든 투표] DB ERR"));
      res.send({ state: "dbConnect fail", err: err });
    }

    res.send({ voteList: rows });
  });
};

// 내가 만든 투표 푸쉬 보내기
const VotePush = function(req, res, next) {
  var groupid = req.params.groupId;
  var voteid = req.params.voteId;

  var voteQuery = "select * from Votes where RawID = ?;";

  conn.query(voteQuery, voteid, function(err, rows) {
    if (err) {
      logger.error("[내가 만든 투표 푸쉬 보내기] DB ERR => " + err);
      Sentry.captureException(new Error("[내가 만든 투표 푸쉬 보내기] DB ERR"));
      res.send({ state: "dbConnect fail", err: err });
    }

    if (rows.length > 0) {
      SendToFCM(groupid, voteid, rows[0].VoteName, rows[0].ETC);
    }
    res.send(AddSuccess(true, "FCM 발송"));
  });
};

// 투표 만료 시 푸쉬 보내기
const ExVotesPush = function(req, res, next) {
  var dt = new Date();
  var exStartDate =
    dt.getFullYear() +
    "-" +
    (dt.getMonth() + 1) +
    "-" +
    (dt.getDate() - 1) +
    " 18:00:00";

  var exEndDate =
    dt.getFullYear() +
    "-" +
    (dt.getMonth() + 1) +
    "-" +
    dt.getDate() +
    " 18:00:00";

  var query =
    "select RawID, VoteName, ETC, GroupID from Votes where EndDate >= ? and EndDate < ? ; ";
  var condition = [exStartDate, exEndDate];

  conn.query(query, condition, function(err, rows) {
    if (err) {
      logger.error("[투표 만료 시 푸쉬 보내기] DB ERR => " + err);
      Sentry.captureException(new Error("[투표 만료 시 푸쉬 보내기] DB ERR"));
      res.send({ state: "dbConnect fail", err: err });
    }

    for (var i = 0; i < rows.length; i++) {
      var title = "투표 종료! (" + rows[i].VoteName + ")";
      SendToFCM(rows[i].GroupID, rows[i].RawID, title, rows[i].ETC);
    }

    res.send(AddSuccess(true, "종료 투표 " + rows.length + "개 FCM 발송"));
  });
};

var groupListToJson = function(rows) {
  var array = [];
  if (rows.length > 0) {
    for (var i = 0; i < rows.length; i++) {
      var row = {
        groupId: rows[i].groupId,
        groupName: rows[i].groupName,
        groupUserCount: rows[i].groupUserCount,
        completeVotes: rows[i].completeVotes,
        notCompleteVotes: rows[i].notCompleteVotes,
      };
      array.push(row);
    }

    return array;
  }
};

var groupListResult = function(isfirst, userid, grouplist) {
  var result = {
    isFirst: isfirst,
    userId: userid,
    groupList: grouplist,
  };

  return result;
};

var voteListResult = function(inglist, endlist) {
  var result = {
    ingList: inglist,
    endList: endlist,
  };

  return result;
};

var AddSuccess = function(isSuccess, msg) {
  var result = {
    isSuccess: isSuccess,
    msg: msg,
  };

  return result;
};

var ConvertTimeToDate = function(time) {
  var dt = new Date(time.toString());
  var dts = dt.setTime(dt.getTime() + 540 * 60000);
  var kst = moment(dts);

  return kst.toJSON();
};

var SendToFCM = function(_groupId, _voteId, _title, _contents) {
  var dtQuery =
    " select u.DeviceToken " +
    " from Users as u " +
    " join GroupJoin as gj on u.RawID = gj.UserID " +
    " where gj.GroupID = ?; ";

  conn.query(dtQuery, _groupId, function(err, rows) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].DeviceToken != null) {
        var _temp = new Object();
        _temp.deviceToken = rows[i].DeviceToken;
        _temp.title = _title;
        _temp.contents = _contents;
        _temp.groupId = _groupId;
        _temp.voteId = _voteId;
        _fcm.Send(_temp);
      }
    }
  });
};

module.exports = {
  GetGroups: GetGroups,
  CreateGroups: CreateGroups,
  JoinGroups: JoinGroups,
  GetVotes: GetVotes,
  GetVoteInfo: GetVoteInfo,
  GetVoteDetail: GetVoteDetail,
  DoVote: DoVote,
  CreateVote: CreateVote,
  MyVotes: MyVotes,
  VotePush: VotePush,
  ExVotesPush: ExVotesPush,
};
