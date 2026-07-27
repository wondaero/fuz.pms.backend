import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import pool from "../db";
import { PROJECT_STATUS } from "../../common/constants";

const router = Router();

interface Participant {
    id: number;
    name: string;
    mm_value: number;
    monthly_cost: number;
}

interface RawProject {
    id: number;
    name: string;
    client_name: string;
    project_type: string;
    start_date: string;
    end_date: string;
    budget: number | string; // 마스킹 후에는 '********' 문자열이 되므로 유니온 타입!
    status: string;
    dept: string;
    created_by: number;
    required_planner: number;
    required_designer: number;
    required_publisher: number;
    required_developer: number;
    required_etc: number;
    note: string | null;
    participants: Participant[]; // 🎯 JSON_AGG로 묶인 배열 타입 지정!
    totalCost?: number;
}

/**
 * @openapi
 * /project:
 *   post:
 *     summary: 새로운 프로젝트 생성
 *     description: 최고관리자(SUPERADMIN) 혹은 관리자(ADMIN) 권한의 유저가 신규 프로젝트를 등록합니다.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - client_name
 *               - project_type
 *               - start_date
 *               - end_date
 *               - budget
 *               - status
 *             properties:
 *               name:
 *                 type: string
 *                 example: 차세대 그룹웨어 리뉴얼
 *               client_name:
 *                 type: string
 *                 example: 현대자동차
 *               project_type:
 *                 type: string
 *                 example: SI
 *               start_date:
 *                 type: string
 *                 format: date
 *                 example: 2026-08-01
 *               end_date:
 *                 type: string
 *                 format: date
 *                 example: 2026-12-31
 *               budget:
 *                 type: integer
 *                 example: 500000000
 *               status:
 *                 type: string
 *                 example: PENDING
 *               required_planner:
 *                 type: integer
 *                 example: 1
 *               required_designer:
 *                 type: integer
 *                 example: 2
 *               required_publisher:
 *                 type: integer
 *                 example: 1
 *               required_developer:
 *                 type: integer
 *                 example: 4
 *               required_etc:
 *                 type: integer
 *                 example: 0
 *               note:
 *                 type: string
 *                 example: 특이사항 없음
 *     responses:
 *       201:
 *         description: 프로젝트 생성 완료
 *       400:
 *         description: 필수 값 누락
 *       403:
 *         description: 권한 부족 (일반 USER 등)
 *       500:
 *         description: 서버 오류
 */
router.post("/", authMiddleware, async (req, res) => {
    const userAuth = (req as any).user?.auth;
    const userId = (req as any).user?.id;
    const userDept = (req as any).user?.dept;
    if (userAuth === 'USER') {
        return res.status(403).json({ message: "현재권한으로는 프로젝트를 생성할 수 없습니다." });
    }

    const { name, client_name, project_type, start_date, end_date, budget, status, note, required_planner, required_designer, required_publisher, required_developer, required_etc } = req.body;
    if (!name || !client_name || !project_type || !start_date || !end_date || !budget || !status) {
        return res.status(400).json({ message: "필수 정보를 모두 입력해주세요." })
    }

    try {
        const insertQuery = `
            INSERT INTO projects (name, client_name, project_type, start_date, end_date, budget, status, required_planner, required_designer, required_publisher, required_developer, required_etc, note, created_by, dept)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id;
        `;

        const newProject = await pool.query(insertQuery, [name, client_name, project_type, start_date, end_date, budget, status, required_planner || 0, required_designer || 0, required_publisher || 0, required_developer || 0, required_etc || 0, note || null, userId, userDept]);

        return res.status(201).json({ message: "새로운 프로젝트 등록을 완료했습니다.", data: newProject.rows[0] });
    } catch (err) {
        console.error("프로젝트 생성 에러:", err);
        return res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }

});

/**
 * @openapi
 * /project:
 *   get:
 *     summary: 전체 프로젝트 목록 조회
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 프로젝트 목록 조회 성공
 *       500:
 *         description: 서버 오류
 */
router.get("/", authMiddleware, async (req, res) => {
    const { order, isWarning, project_type } = req.query;
    const userAuth = (req as any).user?.auth;
    const userId = (req as any).user?.id;
    const userDept = (req as any).user?.dept;
    try {
        const projectQuery = `
            SELECT pj.*,
            COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', pt.user_id, 
                        'mm_value', pt.mm_value,
                        'monthly_cost', pt.monthly_cost,
                        'name', u.name
                    )
                ) FILTER (WHERE pt.id IS NOT NULL),
                 '[]'::json
            ) AS participants
            FROM projects AS pj
            LEFT JOIN participants AS pt ON pj.id = pt.project_id
            LEFT JOIN users AS u ON pt.user_id = u.id
            WHERE pj.status != '${PROJECT_STATUS.COMPLETED}'
            GROUP BY pj.id
            ORDER BY pj.start_date ${order === 'ASC' ? 'ASC' : 'DESC'};
        `;
        const currentProject = await pool.query(projectQuery);

        const authFilter = () => userAuth !== 'USER';

        let cstmProjectData = currentProject.rows.map((p: RawProject) => {
            return ({
                ...p,
                budget: authFilter() ? p.budget : '***',
                totalCost: authFilter() ? (p.participants.reduce((prev: number, curr: Participant) => prev + Number(curr.monthly_cost), 0) || 0) : '***',
                participants: p.participants.map((u: Participant) => ({ id: u.id, name: u.name }))
            })
        })


        //필터 조건

        // 🎯 오늘 날짜 기준선 정의 (비교용)
        const today = new Date();

        if (project_type) {
            cstmProjectData = cstmProjectData.filter((p: RawProject) => p.project_type === project_type);
        }

        if (isWarning === 'true') {
            cstmProjectData = cstmProjectData.filter((p: RawProject) => {
                return (userAuth !== 'USER' && Number(p.budget) < Number(p.totalCost)) || new Date(p.end_date) < today
            })
        }

        return res.status(200).json({
            message: "성공적으로 대시보드 데이터를 가져왔습니다",
            data: {
                projects: cstmProjectData,
            }
        });
    }
    catch (err) {
        console.error("대시보드 데이터 조회 에러:", err);
        return res.status(500).json({ message: "서버 오류가 발생했습니다." })
    }
});




/**
 * @openapi
 * /project/{projectId}:
 *   get:
 *     summary: 특정 프로젝트 상세 조회
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 프로젝트 ID
 *     responses:
 *       200:
 *         description: 상세 조회 성공
 *       404:
 *         description: 프로젝트 없음
 *       500:
 *         description: 서버 오류
 */
router.get("/:projectId", authMiddleware, (req, res) => { });

export default router;
