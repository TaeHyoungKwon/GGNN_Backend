const ctrl = require(__dirname + "/groups.ctrl");
const router = require("express").Router();
var util = require("__dirname + /../../util");
// const logDir = "~/workspce";

// if (!fs.existsSync(logDir)) {
//   fs.mkdirSync(logDir);
// }

// 로그인 시 모임 리스트 호출
router.get("/:email", util.verifyToken, ctrl.GetGroups);

// 모임 만들기
router.post("/:userId/groups", util.verifyToken, ctrl.CreateGroups);

// 모임 가입
router.post("/:userId/groups/join", util.verifyToken, ctrl.JoinGroups);

// 투표 리스트 호출
router.get("/:userId/groups/:groupId/votes", util.verifyToken, ctrl.GetVotes);

// 투표 리스트 투표 정보 호출
router.get(
  "/:userId/groups/:groupId/votes/:voteId",
  util.verifyToken,
  ctrl.GetVoteInfo
);

// 투표 디테일 정보 호출
router.get(
  "/:userId/groups/:groupId/votes/:voteId/detail",
  util.verifyToken,
  ctrl.GetVoteDetail
);

// 투표하기
router.put(
  "/:userId/groups/:groupId/votes/:voteId/detail/:voting",
  util.verifyToken,
  ctrl.DoVote
);

// 투표 만들기
router.post(
  "/:userId/groups/:groupId/votes",
  util.verifyToken,
  ctrl.CreateVote
);

// 내가 만든 투표
router.get("/:userId/info/votes", util.verifyToken, ctrl.MyVotes);

// 내가 만든 투표 푸쉬 보내기
router.all(
  "/:userId/Info/votes/:groupId/:voteId",
  util.verifyToken,
  ctrl.VotePush
);

// 투표 만료 시 푸쉬 보내기
router.all("/votes/expiration", ctrl.ExVotesPush);

module.exports = router;
