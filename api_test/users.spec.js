const request = require("supertest");
const should = require("should");
const app = require("../app");

describe("GET /:email", () => {
  describe("성공 시", () => {
    it("중복이 아닐 때, isDuplicated:0을 반환한다.", done => {
      request(app)
        .get("/users/check/1234@naver.com")
        .end((err, res) => {
          res.body.should.have.property("isDuplicated", 0);
          done();
        });
    });

    it("중복 일 떄, isDuplicated:1을 반환한다.", done => {
      request(app)
        .get("/users/check/kwon5604@naver.com")
        .end((err, res) => {
          res.body.should.have.property("isDuplicated", 1);
          done();
        });
    });
  });
});

describe("GET /:email", () => {
  describe("실패 시", () => {
    it("메일 형식이 올바르지 않을 때,", done => {
      request(app)
        .get("/users/check/1234naver.com")
        .expect(400)
        .end(done);
    });
  });
});

describe("POST /users", () => {
  describe("회원가입 성공시", () => {
    let body;
    before(done => {
      request(app)
        .post("/users")
        .send({
          userName: "권태형",
          email: "kwon5604@naver.com",
          nickName: "태형짱",
          clubName: "사통백이",
          rankName: "졸업선배",
          etc: "없음",
        })
        .expect(201)
        .end((err, res) => {
          body = res.body;
          done();
        });
    });

    it("DB에 생성된 유저 객체 result:1을 반환한다", done => {
      setTimeout(done, 300);
      body.should.have.property("result", 1);
    });
  });
});

describe("POST /users", () => {
  describe("실패 시", () => {
    it("post를 통해 받아오는 값들 중 null이 있을 경우에 상태코드 400을 반환한다", done => {
      request(app)
        .post("/users")
        .send({
          userName: "",
          email: "kwon5604@naver.com",
          nickName: "",
          clubName: "사통백이",
          rankName: "졸업선배",
          etc: "없음",
        })
        .expect(400)
        .end(done);
    });
  });
});

describe("GET /:userId", () => {
  describe("성공 시", () => {
    it("userId가 1인 유저 객체를 반환한다.", done => {
      request(app)
        .get("/users/1")
        .end((err, res) => {
          res.body.should.have.property("RawID", 1);
          done();
        });
    });
  });
});

describe("GET /:userId", () => {
  describe("실패 시", () => {
    it("userId가 숫자가 아닐 경우 400으로 응답한다.", done => {
      request(app)
        .get("/users/one")
        .expect(400)
        .end(done);
    });

    it("userId로 유저를 찾을 수 없을 경우 404로 응답한다.", done => {
      request(app)
        .get("/users/10000")
        .expect(404)
        .end(done);
    });
  });
});
