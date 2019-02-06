const request = require("supertest");
const should = require("should");
const app = require("../app");

describe("GET /api/:email는", () => {
  describe("성공시", () => {
    it("로그인시 모임 리스트를 호출 한다.", done => {
      request(app)
        .get("/api/sw@kp.com/")
        .end((err, res) => {
          res.body.should.have.property("userId", 1);
          done();
        });
    });
  });
});

// describe("POST /:userId/groups는,", () => {
//   describe("성공시", () => {
//     it("userId로 그룹을 만든다.", done => {
//       request(app)
//         .post("/1/groups")
//         .send({ groupName: "test", groupCode: "test1" })
//         .end((err, res) => {});
//     });
//   });
// });

// describe("", () => {
//   describe("", () => {
//     it("", done => {});
//   });
// });
