import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import jwt from "jsonwebtoken";
import pool from "../db"
import bcrypt from "bcryptjs";
import { PROJECT_STATUS } from "../../common/constants";

const SECRET_KEY = "test1";

const router = Router();

const pepper1 = process.env.PASSWORD_PEPPER1 || "";
const pepper2 = process.env.PASSWORD_PEPPER2 || "";

const getPepperedPw = (pw: string) => pepper1 + pw + pepper2;

const remakePassword = async (pw: string) => {
  return bcrypt.hash(getPepperedPw(pw), 10);
}


/**
 * @openapi
 * /user/signup:
 *   post:
 *     summary: 회원가입 (신규 직원 계정 생성)
 *     tags: [Users & Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - pw
 *               - name
 *               - phone
 *             properties:
 *               email:
 *                 type: string
 *                 example: test@fuz.co.kr
 *               pw:
 *                 type: string
 *                 example: "1234"
 *               name:
 *                 type: string
 *                 example: 홍길동
 *               phone:
 *                 type: string
 *                 example: 010-1234-5678
 *               dept:
 *                 type: string
 *                 example: 개발본부
 *               role:
 *                 type: string
 *                 example: 개발
 *     responses:
 *       201:
 *         description: 회원가입 완료 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 회원가입이 완료되었습니다.
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 10
 *                     email:
 *                       type: string
 *                       example: test@fuz.co.kr
 *                     name:
 *                       type: string
 *                       example: 홍길동
 *                     phone:
 *                       type: string
 *                       example: 010-1234-5678
 *                     created_at:
 *                       type: string
 *                       example: "2026-07-21T15:20:00.000Z"
 *       400:
 *         description: 필수 정보 입력 누락
 *       409:
 *         description: 이미 사용 중인 이메일
 */
//회원가입(유저가 가입)
router.post("/signup", async (req, res) => {
  const { email, pw, name, phone, dept, role } = req.body;
  if (!email || !pw || !name || !phone) {
    return res.status(400).json({ message: "필수 정보를 모두 입력해주세요." })
  }

  try {
    const userCheck = await pool.query("SELECT email FROM users WHERE email = $1", [email]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ message: "이미 사용 중인 이메일입니다." });
    }

    const insertQuery = `
      INSERT INTO users (email, password, name, phone, dept, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, name, phone, created_at
    `;

    const newUser = await pool.query(insertQuery, [email, await remakePassword(pw), name, phone, dept || null, role || null]);

    return res.status(201).json({ message: "회원가입이 완료되었습니다.", data: newUser.rows[0] });
  } catch (err) {
    console.log('회원가입 에러:', err);
    return res.status(500).json({ message: "서버 오류가 발생했습니다." })
  }
});

/**
 * @openapi
 * /user/login:
 *   post:
 *     summary: 로그인 (JWT 토큰 발급)
 *     tags: [Users & Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - pw
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin
 *               pw:
 *                 type: string
 *                 example: "0000"
 *     responses:
 *       200:
 *         description: 로그인 성공 및 토큰 반환
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 성공적으로 로그인했습니다.
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbiIsIm5hbWUiOiLqsIDrppzsjbAiLCJhdXRoIjoiQURNSU4ifQ...
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     email:
 *                       type: string
 *                       example: admin
 *                     name:
 *                       type: string
 *                       example: 관리자
 *                     auth:
 *                       type: string
 *                       example: ADMIN
 *                     phone:
 *                       type: string
 *                       example: 010-0000-0000
 *                     dept:
 *                       type: string
 *                       example: 경영기획팀
 *                     role:
 *                       type: string
 *                       example: 기획
 *                     level:
 *                       type: string
 *                       example: 초급
 *                     position:
 *                       type: string
 *                       example: 사원
 *                     monthly_cost:
 *                       type: integer
 *                       example: 1000000
 *                     status:
 *                       type: string
 *                       example: 재직
 *       401:
 *         description: 아이디 또는 비밀번호 불일치
 */
//로그인
router.post("/login", async (req, res) => {
  const { email, pw } = req.body;

  // 1. 데이터 검증 (입력값이 없는 경우)
  if (!email || !pw) {
    return res.status(400).json({ message: "아이디와 비밀번호를 입력해주세요." });
  }

  try {
    const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    const validUser = userCheck.rows[0];

    if (!validUser) {
      return res.status(401).json({ message: "아이디 또는 비밀번호가 잘못되었습니다2." });
    }

    const isMatch = await bcrypt.compare(getPepperedPw(pw), validUser.password);

    if (isMatch) {
      // JWT 발행
      const token = jwt.sign(
        {
          id: validUser.id,
          email: validUser.email,
          name: validUser.name,
          auth: validUser.auth,
          dept: validUser.dept
        }, // 페이로드
        SECRET_KEY, // 시크릿 키
        { expiresIn: "1h" }, // 유효시간 1시간
      );

      const { password, ...userInfo } = validUser;

      return res.status(200).json({ message: "성공적으로 로그인했습니다.", data: userInfo, token });
    } else {
      return res.status(401).json({ message: "아이디 또는 비밀번호가 잘못되었습니다." });
    }
  }
  catch (err) {
    console.log("로그인 에러:", err);
    return res.status(500).json({ logined: false, message: "서버 오류가 발생했습니다." })
  }
});

/**
 * @openapi
 * /user/{userId}:
 *   patch:
 *     summary: 유저 정보 수정 (관리자 또는 본인)
 *     tags: [Users & Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: update@fuz.co.kr
 *               password:
 *                 type: string
 *                 example: "1234"
 *               auth:
 *                 type: string
 *                 example: ADMIN
 *               name:
 *                 type: string
 *                 example: 홍길동
 *               phone:
 *                 type: string
 *                 example: 010-9999-8888
 *               dept:
 *                 type: string
 *                 example: 경영기획팀
 *               role:
 *                 type: string
 *                 example: 기획
 *               level:
 *                 type: string
 *                 example: 고급
 *               position:
 *                 type: string
 *                 example: 과장
 *               monthly_cost:
 *                 type: integer
 *                 example: 5000000
 *               status:
 *                 type: string
 *                 example: 재직
 *               note:
 *                 type: string
 *                 example: 특이사항 없음
 *     responses:
 *       200:
 *         description: 유저 정보 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 성공적으로 수정되었습니다.
 *       400:
 *         description: 수정할 정보가 없거나 잘못된 입력
 *       403:
 *         description: 수정 권한 없음
 *       404:
 *         description: 유저를 찾을 수 없음
 */
//유저정보 변경(비밀번호 포함)
router.patch("/:userId", authMiddleware, async (req, res) => {
  const { userId } = req.params;
  const { email, password, auth, name, phone, dept, role, level, position, monthly_cost, status, note } = req.body;
  const userAuth = (req as any).user?.auth;
  const currentUserId = (req as any).user?.id;

  const conditions: string[] = [];
  const values: any[] = [];

  const addUpdateCol = (obj: Record<string, any>, only?: string[]) => {
    const colName = Object.keys(obj)[0];
    const val = Object.values(obj)[0];

    if (val == undefined) return;

    let valid = true;

    only?.forEach((allowAuth) => {
      if (allowAuth === 'admin' && userAuth !== 'ADMIN') {
        valid = false;
      }
      if (allowAuth === 'self' && Number(currentUserId) !== Number(userId)) {
        valid = false;
      }
    })

    if (!valid) return;

    values.push(val);
    conditions.push(`${colName} = $${values.length}`);
  }

  try {
    if (userAuth !== "ADMIN" && Number(userId) !== Number(currentUserId)) {
      return res.status(403).json({ message: "수정 권한이 없습니다." });
    }

    addUpdateCol({ email }, ['admin', 'self']);
    if (password) {
      const hashedPassword = await remakePassword(password); // 🔒 비번 변경 시 bcrypt 암호화!
      addUpdateCol({ password: hashedPassword }, ['admin', 'self']);
    }
    addUpdateCol({ auth }, ['admin']);
    addUpdateCol({ name }, ['admin', 'self']);
    addUpdateCol({ phone }, ['admin', 'self']);
    addUpdateCol({ dept }, ['admin']);
    addUpdateCol({ role }, ['admin']);
    addUpdateCol({ level }, ['admin']);
    addUpdateCol({ position }, ['admin']);
    addUpdateCol({ monthly_cost }, ['admin']);
    addUpdateCol({ status }, ['admin']);
    addUpdateCol({ note }, ['admin']);

    if (!values.length) {
      return res.status(400).json({ message: " 수정할 정보가 없습니다." })
    }

    // 🎯 쿼리 실행 직전에 userId를 values 배열 맨 뒤에 추가!
    values.push(userId);


    const updateQuery = `UPDATE users SET ${conditions.join(", ")} WHERE id = $${values.length}`

    await pool.query(updateQuery, values);
    return res.status(200).json({ message: "성공적으로 수정되었습니다." });
  } catch (err) {
    console.log("유저 수정 에러:", err);
    return res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

/**
 * @openapi
 * /user/{userId}:
 *   delete:
 *     summary: 유저 계정 삭제 / 퇴사 처리 (관리자 전용)
 *     tags: [Users & Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: 유저 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 유저가 성공적으로 삭제되었습니다.
 *       403:
 *         description: 삭제 권한 없음
 *       404:
 *         description: 유저를 찾을 수 없음
 */
//유저 삭제
router.delete("/:userId", authMiddleware, async (req, res) => {
  const { userId } = req.params;
  const currentUserAuth = (req as any).user?.auth;
  const currentUserId = (req as any).user?.id;

  if (Number(userId) === Number(currentUserId)) {
    return res.status(403).json({ message: "본인은 삭제할 수 없습니다." });
  }

  try {
    if (currentUserAuth !== 'ADMIN') {
      return res.status(403).json({ message: "삭제 권한이 없습니다." });
    }

    const userCheck = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (userCheck.rows.length === 0) return res.status(404).json({ message: "유저를 찾을 수 없습니다." });

    const deleteQuery = "DELETE FROM users WHERE id = $1";
    await pool.query(deleteQuery, [userId]);

    return res.status(200).json({ message: "유저가 성공적으로 삭제되었습니다." });

  } catch (err) {
    console.log("유저 삭제 에러:", err)
    return res.status(500).json({ message: "서버 오류가 발생했습니다." })
  }
});

/**
 * @openapi
 * /user:
 *   get:
 *     summary: 유저 목록 조회 (검색 필터 포함)
 *     tags: [Users & Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         example: 홍길동
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         example: aa@fuz.co.kr
 *       - in: query
 *         name: phone
 *         schema:
 *           type: string
 *         example: 010-0000-0000
 *       - in: query
 *         name: dept
 *         schema:
 *           type: string
 *         example: 인사팀
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         example: 기획
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *         example: 고급
 *       - in: query
 *         name: position
 *         schema:
 *           type: string
 *         example: 대리
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         example: 재직
 *     responses:
 *       200:
 *         description: 유저 목록 반환 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 유저 목록 조회가 완료되었습니다.
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       email:
 *                         type: string
 *                         example: aa@fuz.co.kr
 *                       name:
 *                         type: string
 *                         example: 김인사
 *                       phone:
 *                         type: string
 *                         example: 010-0000-0000
 *                       dept:
 *                         type: string
 *                         example: 인사팀
 *                       role:
 *                         type: string
 *                         example: 기획
 *                       level:
 *                         type: string
 *                         example: 고급
 *                       position:
 *                         type: string
 *                         example: 대리
 *                       monthly_cost:
 *                         type: integer
 *                         example: 1000000
 *                       status:
 *                         type: string
 *                         example: 재직
 */
//유저 목록
router.get("/", authMiddleware, async (req, res) => {
  const { name, email, phone, dept, role, level, position, status } = req.query;

  try {
    const conditions: string[] = [];
    const values: any[] = [];


    const addWhere = (obj: Record<string, any>) => {
      const colName = Object.keys(obj)[0];
      const val = Object.values(obj)[0];

      if (val) {
        values.push(val);
        conditions.push(`${colName} = $${values.length}`);
      }
    }

    addWhere({ name });
    addWhere({ email });
    addWhere({ phone });
    addWhere({ dept });
    addWhere({ role });
    addWhere({ level });
    addWhere({ position });
    addWhere({ status });

    const whereSql = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const userList = await pool.query(`SELECT * FROM users ${whereSql} ORDER BY name ASC`, values);

    const currentUserAuth = (req as any).user?.auth;

    console.log(currentUserAuth);

    let resultData = userList.rows;
    if (currentUserAuth !== 'ADMIN') {
      // 일반 유저 (USER): 비밀번호, monthly_cost 제거
      resultData = userList.rows.map((user: any) => {
        const { password, monthly_cost, ...safeUser } = user;
        return safeUser;
      });
    } else {
      // 관리자 (ADMIN): 비밀번호만 제거 (monthly_cost는 보임)
      resultData = userList.rows.map((user: any) => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
    }
    return res.status(200).json({ message: "유저 목록 조회가 완료되었습니다.", data: resultData });
  } catch (err) {
    return res.status(500).json({ message: "서버 오류가 발생했습니다." })
  }

});

/**
 * @openapi
 * /user/{userId}:
 *   get:
 *     summary: 유저 상세 정보 조회
 *     tags: [Users & Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: 유저 상세 정보 반환 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 유저 상세정보를 성공적으로 가져왔습니다.
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     email:
 *                       type: string
 *                       example: admin
 *                     name:
 *                       type: string
 *                       example: 관리자
 *                     phone:
 *                       type: string
 *                       example: 010-0000-0000
 *                     dept:
 *                       type: string
 *                       example: 경영기획팀
 *                     role:
 *                       type: string
 *                       example: 기획
 *                     level:
 *                       type: string
 *                       example: 초급
 *                     position:
 *                       type: string
 *                       example: 사원
 *                     monthly_cost:
 *                       type: integer
 *                       example: 1000000
 *                     status:
 *                       type: string
 *                       example: 재직
 *                     note:
 *                       type: string
 *                       example: 테스트
 *       404:
 *         description: 유저를 찾을 수 없음
 */
//유저 상세 정보
router.get("/:userId", authMiddleware, async (req, res) => {
  const { userId } = req.params;

  try {
    const resultUser = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);


    if (resultUser.rows.length === 0) {
      return res.status(404).json({ message: "유저를 찾을 수 없습니다." });
    }

    let resultData;

    const currentUserId = (req as any).user?.id;
    const currentUserAuth = (req as any).user?.auth;

    if (Number(currentUserId) === Number(userId) || currentUserAuth === 'ADMIN') {
      const { password, ...safeData } = resultUser.rows[0];
      resultData = safeData;
    } else {
      const { password, monthly_cost, level, ...safeData } = resultUser.rows[0];
      resultData = safeData;
    }

    return res.status(200).json({ message: "유저 상세정보를 성공적으로 가져왔습니다.", data: resultData });
  } catch (err) {
    return res.status(500).json({ message: "서버 오류가 발생했습니다." })
  }


});

const targetMonth = (targetDate: string) => {
  const yearMonth = targetDate.split('-');

  const year = yearMonth[0];
  const month = yearMonth[1];

  if (!year || !month) {
    console.log('잘못된 값입니다.')
    return;
  }

  // 타임존 버그를 피하기 위해 padStart 및 로직 보강
  const monthStart = `${year}-${month.padStart(2, '0')}-01`;

  // 타임존 오프셋 안전한 말일 계산법 (로컬 날짜 추출)
  const lastDay = new Date(Number(year), Number(month), 0);
  const monthEnd = `${lastDay.getFullYear()}-${(lastDay.getMonth() + 1).toString().padStart(2, '0')}-${lastDay.getDate().toString().padStart(2, '0')}`;

  return { month, monthStart, monthEnd };
}

/**
 * @openapi
 * /user/resource/project:
 *   get:
 *     summary: "프로젝트별 M/M 자원 현황 조회"
 *     description: "특정 프로젝트 및 기간을 기준으로 투입된 인원과 그 인원들의 전체 참여 프로젝트 정보를 가져옵니다."
 *     tags: [Users & Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: project_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: "조회할 프로젝트 ID"
 *         example: 1
 *       - in: query
 *         name: target_date
 *         required: true
 *         schema:
 *           type: string
 *         description: "기준 연월 (YYYY-MM)"
 *         example: "2026-07"
 *     responses:
 *       200:
 *         description: "성공적으로 리소스 데이터를 가져왔습니다."
 *       400:
 *         description: "필수 파라미터 누락 또는 잘못된 형식"
 *       500:
 *         description: "서버 오류"
 */
router.get("/resource/project", authMiddleware, async (req, res) => {
  const { project_id, target_date } = req.query as { project_id?: string; target_date: string };

  if (!project_id || !target_date) {
    return res.status(400).json({ message: "필수 파라미터가 누락됐습니다." });
  }

  const userAuth = (req as any).user?.auth;
  const userDept = (req as any).user?.dept;
  // const userId = (req as any).user?.id;

  const yearMonth = target_date.split('-');

  const year = yearMonth[0];
  const month = yearMonth[1];

  if (!year || !month) {
    return res.status(400).json({ message: "잘못된 요청값 입니다." });
  }

  // 타임존 버그를 피하기 위해 padStart 및 로직 보강
  const monthStart = `${year}-${month.padStart(2, '0')}-01`;

  // 타임존 오프셋 안전한 말일 계산법 (로컬 날짜 추출)
  const lastDay = new Date(Number(year), Number(month), 0);
  const monthEnd = `${lastDay.getFullYear()}-${(lastDay.getMonth() + 1).toString().padStart(2, '0')}-${lastDay.getDate().toString().padStart(2, '0')}`;

  try {
    const queryParams: any[] = [monthEnd, monthStart];

    let whereClause = `
            WHERE pj.status != '${PROJECT_STATUS.COMPLETED}'
              AND pj.start_date <= $1
              AND pj.end_date >= $2
        `;

    if (userAuth === 'USER') {
      queryParams.push(userDept);
      whereClause += ` AND pj.dept = $${queryParams.length}`;
    }

    if (project_id) {
      queryParams.push(parseInt(project_id, 10));
      whereClause += ` AND pj.id = $${queryParams.length}`;
    }

    const projectQuery = `
            SELECT 
                pj.id,
                pj.name,
                pj.project_type,
                TO_CHAR(pj.start_date, 'YYYY-MM-DD') AS start_date,
                TO_CHAR(pj.end_date, 'YYYY-MM-DD') AS end_date,
                pj.status,
                pj.dept,
                pj.note,
                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'id', pt.user_id,
                            'name', u.name,
                            'mm_value', pt.mm_value,
                            'start_date', pt.start_date,
                            'end_date', pt.end_date,
                            'role', u.role,
                            -- 🎯 [마법의 스칼라 서브쿼리] 이 직원이 현재 참여중인 모든 프로젝트 일정을 직접 집계!
                            'all_projects', COALESCE(
                                (
                                    SELECT JSON_AGG(
                                        JSON_BUILD_OBJECT(
                                            'project_id', sub_pt.project_id,
                                            'project_name', sub_pj.name,
                                            'start_date', sub_pt.start_date,
                                            'end_date', sub_pt.end_date,
                                            'mm_value', sub_pt.mm_value
                                        )
                                    )
                                    FROM participants AS sub_pt
                                    JOIN projects AS sub_pj ON sub_pt.project_id = sub_pj.id
                                    WHERE sub_pt.user_id = pt.user_id
                                ),
                                '[]'::json
                            )
                        )
                    ) FILTER (WHERE pt.id IS NOT NULL),
                     '[]'::json
                ) AS participants
            FROM projects AS pj
            LEFT JOIN participants AS pt ON pj.id = pt.project_id
            LEFT JOIN users AS u ON pt.user_id = u.id
            ${whereClause}
            GROUP BY pj.id
            ORDER BY pj.start_date DESC;
        `;
    const targetProjects = await pool.query(projectQuery, queryParams);


    const cstmProjectData = targetProjects.rows;

    return res.status(200).json({
      message: `성공적으로 '${month}월'의 리소스 데이터를 가져왔습니다.`,
      data: {
        projects: cstmProjectData,
      }
    });
  }
  catch (err) {
    console.error("리소스 데이터 조회 에러:", err);
    return res.status(500).json({ message: "서버 오류가 발생했습니다." })
  }
});

const resourceQuery = (whereClause: any, queryParams: any[], order: string) => {
  const tmpArr: string[] = [];
  for (let key in whereClause) {
    tmpArr.push(`${key} = $${queryParams.length + 1}`)
    queryParams.push(whereClause[key]);
  }

  const query = `
            SELECT
              u.name,
              u.dept,
              u.position,
              COALESCE(
                JSON_AGG(
                  JSON_BUILD_OBJECT(
                    'project_id', pj.id,
                    'project_name', pj.name,
                    'project_start_date', TO_CHAR(pj.start_date, 'YYYY-MM-DD'),
                    'project_end_date', TO_CHAR(pj.end_date, 'YYYY-MM-DD'),
                    'mm_value', pt.mm_value,
                    'user_start_date', TO_CHAR(pt.start_date, 'YYYY-MM-DD'),
                    'user_end_date', TO_CHAR(pt.end_date, 'YYYY-MM-DD')
                  )
                ) FILTER (WHERE pj.id IS NOT NULL),
                '[]'::json
              ) AS project_list
            FROM users AS u
            LEFT JOIN participants AS pt ON u.id = pt.user_id
            AND pt.start_date <= $1
            AND pt.end_date >= $2
            LEFT JOIN projects AS pj ON pt.project_id = pj.id AND pj.status != 'COMPLETED'
            ${tmpArr.length > 0 ? 'WHERE ' + tmpArr.join(' AND ') : ''}
            GROUP BY u.id
            ORDER BY ${order} ASC, u.name ASC;
        `;

  return query;
}

/**
 * @openapi
 * /user/resource/dept:
 *   get:
 *     summary: "직원별 프로젝트 투입 근황 조회 (부서별)"
 *     description: "기준 연월 및 로그인한 유저의 부서에 속한 직원들의 프로젝트 투입 정보와 M/M 할당 현황을 조회합니다."
 *     tags: [Users & Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: target_date
 *         required: true
 *         schema:
 *           type: string
 *         description: "기준 연월 (YYYY-MM)"
 *         example: "2026-07"
 *     responses:
 *       200:
 *         description: "성공적으로 리소스 데이터를 가져왔습니다."
 *       400:
 *         description: "필수 파라미터 누락 또는 잘못된 형식"
 *       500:
 *         description: "서버 오류"
 */
router.get("/resource/dept", authMiddleware, async (req, res) => {
  const userDept = (req as any).user?.dept;
  const userAuth = (req as any).user?.auth;

  const { target_date } = req.query as { target_date: string };

  if (!target_date) {
    return res.status(400).json({ message: "날짜(YYYY-MM)를 입력해주세요." });
  }

  const dateData = targetMonth(target_date);

  if (!dateData) {
    return res.status(400).json({ message: "잘못된 요청값 입니다." });
  }

  const { month, monthStart, monthEnd } = dateData;

  try {
    const queryParams: any[] = [monthEnd, monthStart];

    const whereClause: any = {};

    if (userAuth === 'USER') whereClause['u.dept'] = userDept;

    const targetUsers = await pool.query(resourceQuery(whereClause, queryParams, 'u.dept'), queryParams);

    const cstmUserData = targetUsers.rows;

    return res.status(200).json({
      message: `성공적으로 '${month}월'의 리소스 데이터를 가져왔습니다.`,
      data: {
        users: cstmUserData,
      }
    });
  }
  catch (err) {
    console.error("리소스 데이터 조회 에러:", err);
    return res.status(500).json({ message: "서버 오류가 발생했습니다." })
  }
});


router.get("/resource/assignable", authMiddleware, async (req, res) => {
  const userAuth = (req as any).user?.auth;
  if (userAuth === 'USER') {
    return res.status(403).json({ message: "권한이 없습니다." });
  }

  const userDept = (req as any).user?.dept;
  const MIN_AVAILABLUE_DAYS = 14;

  const { project_id, role, assignable } = req.query as { project_id?: string; role?: string; assignable?: string };

  if (!project_id) {
    return res.status(400).json({ message: "프로젝트 아이디를 입력해주세요." });
  }

  try { // 🎯 3. try 블록 시작
    // 1. 프로젝트 정보 조회
    const projectQuery = `
      SELECT
        id,
        name,
        start_date,
        end_date,
        budget,
        (end_date - start_date) + 1 AS project_days
      FROM projects
      WHERE id = $1;
    `;

    const targetProject = await pool.query(projectQuery, [parseInt(project_id, 10)]);

    if (!targetProject || targetProject.rows.length === 0) {
      return res.status(404).json({ message: "해당 프로젝트를 찾을 수 없습니다." });
    }

    const { start_date, end_date } = targetProject.rows[0];

    // 2. 동적 파라미터 및 WHERE절 조립
    const queryParams: any[] = [end_date, start_date];
    const tmpArr: string[] = ["u.status = 'ACTIVE'"];

    if (role) {
      queryParams.push(role);
      tmpArr.push(`u.role = $${queryParams.length}`);
    }

    const whereSql = tmpArr.length > 0 ? 'WHERE ' + tmpArr.join(' AND ') : '';

    const havingClause = assignable === 'true'
      ? `HAVING (($1::date - $2::date + 1) - COALESCE(SUM(GREATEST(LEAST(pt.end_date, $1::date) - GREATEST(pt.start_date, $2::date) + 1, 0) * pt.mm_value), 0.0)) >= ${MIN_AVAILABLUE_DAYS}`
      : "";

    // 3. 메인 가용 인원 조회 쿼리 정의
    const assignableUserQuery = `
      SELECT 
        u.id,
        u.name,
        u.role,
        u.level,
        u.position,
        u.monthly_cost,
        ($1::date - $2::date + 1) AS total_proj_days,
        
        COALESCE(
          SUM(
            GREATEST(
              LEAST(pt.end_date, $1::date) - GREATEST(pt.start_date, $2::date) + 1, 
              0
            ) * pt.mm_value
          ), 
          0.0
        )::float AS occupied_days,
        
        ROUND(
          (1.0 - (
            COALESCE(
              SUM(
                GREATEST(LEAST(pt.end_date, $1::date) - GREATEST(pt.start_date, $2::date) + 1, 0) * pt.mm_value
              ), 
              0.0
            ) / ($1::date - $2::date + 1)
          ))::numeric * 100, 
          1
        )::float AS availability_percent
        
      FROM users u
      LEFT JOIN participants pt ON u.id = pt.user_id
        AND pt.start_date <= $1
        AND pt.end_date >= $2
      LEFT JOIN projects pj ON pt.project_id = pj.id AND pj.status != 'COMPLETED'
      ${whereSql}
      GROUP BY u.id
      ${havingClause}
      ORDER BY u.name ASC;
    `;

    // 🎯 2. 실제 데이터베이스 호출 실행 및 JSON 응답 반환
    const targetUsers = await pool.query(assignableUserQuery, queryParams);

    return res.status(200).json({
      message: "성공적으로 투입 가능 직원 목록을 가져왔습니다.",
      data: {
        users: targetUsers.rows,
      }
    });

  } catch (err) { // 🎯 3. 에러 캐치
    console.error("투입 가능 직원 조회 에러:", err);
    return res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});


export default router;
