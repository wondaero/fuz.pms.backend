import express from "express";
import { createServer } from "http";
import { initSocket } from "./socket"; // 분리한 소켓 모듈 임포트

import userRouter from "./users/router"; // 유저 라우터
import projectRouter from "./projects/router"; // 프로젝트 라우터
import participantsRouter from "./participants/router"; // 투입인력 라우터
import screenRouter from "./screens/router"; // 페이지 라우터
import cors from "cors";
import { setupSwagger } from "./swagger"; // Swagger 설정 임포트

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const corsOptions = {
  origin: (origin: any, callback: any) => {
    // 개발 편의를 위해 모든 오리진(사설망 IP 포함) 허용
    callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true, // 쿠키나 인증 헤더(토큰)를 사용한다면 필수
};

app.use(cors(corsOptions));

// Swagger UI 연결 (http://localhost:3000/api-docs)
setupSwagger(app);

app.use("/user", userRouter);
app.use("/project", projectRouter);
app.use("/screen", screenRouter);
app.use("/participant", participantsRouter);

// [중요] 여기서 소켓을 초기화해야 합니다!
initSocket(httpServer);

// Dummy comment to trigger nodemon reload for Swagger updates.

httpServer.listen(3000, () => {
  console.log("서버가 http://localhost:3000 에서 실행 중입니다.");
});
