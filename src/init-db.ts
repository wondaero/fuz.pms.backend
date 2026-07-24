import pool from "./db";

const dropTablesQuery = `
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
`;

// 마스터 데이터 테이블 (부서, 직급, 직군, 등급 등 공통 코드 관리)
const mastersTable = `
    CREATE TABLE masters (
        id SERIAL PRIMARY KEY,
        category VARCHAR(50) NOT NULL,   -- 카테고리 구분 (예: 'DEPT', 'POSITION', 'JOB_FAMILY')
        code VARCHAR(50) NOT NULL,       -- 숫자 코드 (예: '001', '002', '003')
        code_name VARCHAR(100) NOT NULL, -- 한글 표기명 (예: '개발본부', '기획본부', '팀장')
        description TEXT,                -- 설명
        sort_order INT DEFAULT 0,        -- 정렬 순서
        is_active BOOLEAN DEFAULT TRUE,  -- 사용 여부
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (category, code)
    );
`;

// 유저 / 직원 테이블 (UI 01 반영)
const userTable = `
    CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(50) UNIQUE NOT NULL, -- id로 활용
        password VARCHAR(255) NOT NULL, -- 로그인 P/W로 사용
        auth VARCHAR(20) NOT NULL DEFAULT 'USER', -- 권한
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        dept VARCHAR(100),         -- 부서
        role VARCHAR(50),    -- 직군/롤 (기획, 디자인, 개발 등)
        level VARCHAR(50),         -- 등급 (초급, 중급, 고급, 특급)
        position VARCHAR(50),      -- 직급 (사원, 선임, 수석, 팀장 등)
        monthly_cost INT DEFAULT 0, -- 월 인건비/원가
        status VARCHAR(50) DEFAULT 'ACTIVE', -- 상태 (ACTIVE, ON_LEAVE, RETIRED)
        is_approved BOOLEAN DEFAULT FALSE,  -- 가입 승인 여부 (기본값 FALSE)
        note TEXT,                 -- 비고
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

// 프로젝트 테이블 (UI 02, UI 04 반영)
const projectsTable = `
    CREATE TABLE projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        client_name VARCHAR(100),       -- 고객사 (예: OO기업)
        project_type VARCHAR(50),       -- 유형 (예: 구축/SI, 유지보수/SM)
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        budget BIGINT DEFAULT 0,        -- 수주 금액/예산
        status VARCHAR(50) DEFAULT '진행중', -- 상태 (대기, 진행중, 완료)
        required_planner INT DEFAULT 0, -- 필요한 기획자
        required_designer INT DEFAULT 0, -- 필요한 디자이너
        required_publisher INT DEFAULT 0, -- 필요한 퍼블리셔
        required_developer INT DEFAULT 0, -- 필요한 개발자
        required_etc INT DEFAULT 0, -- 기타 필요한 인력
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        dept VARCHAR(50) NOT NULL,
        note TEXT,                      -- 비고 / 메모 / 특이사항
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

// 프로젝트 인력 배치 / M/M 배정 테이블 (UI 02, UI 03 반영)
const participantsTable = `
    CREATE TABLE participants (
        id SERIAL PRIMARY KEY,
        project_id INT REFERENCES projects(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        mm_value NUMERIC(3, 2) NOT NULL DEFAULT 1.0, -- 투입 공수 (예: 0.5 M/M, 1.0 M/M)
        monthly_cost INT DEFAULT 0,                  -- 프로젝트 적용 월 인건비/단가
        role VARCHAR(50),                             -- 투입 역할
        level VARCHAR(50),                            -- 투입 당시 등급 (예: JUNIOR, MID, SENIOR, EXPERT)
        note TEXT,                                    -- 비고
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

// 화면 및 세부 기능 단위 권한 관리 테이블 (UI 01~05 세부 권한 반영)
const screenPermissionsTable = `
    CREATE TABLE screen_permissions (
        id SERIAL PRIMARY KEY,
        screen_id VARCHAR(50) NOT NULL,      -- 화면 ID (예: 'USER_LIST', 'PROJECT_DETAIL')
        feature_code VARCHAR(50) NOT NULL,   -- 기능 코드 (예: 'BTN_CREATE_USER', 'COL_MONTHLY_COST')
        feature_name VARCHAR(100) NOT NULL,  -- 기능 이름 (예: '직원 등록 버튼', '원가 컬럼')
        description TEXT,                    -- 기능 설명
        allow_admin BOOLEAN DEFAULT TRUE,    -- admin 허용 여부 (true/false)
        allow_user BOOLEAN DEFAULT FALSE,    -- user 허용 여부 (true/false)
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (screen_id, feature_code)
    );
`;

// 성능 최적화를 위한 인덱스 생성
const indexQueries = `
    -- 1. 마스터 테이블: 카테고리별 조회 및 정렬 속도 향상
    CREATE INDEX idx_masters_category ON masters(category, is_active, sort_order);

    -- 2. 유저 테이블: 부서 및 재직 상태 검색 속도 향상
    CREATE INDEX idx_users_dept ON users(dept);
    CREATE INDEX idx_users_status ON users(status);
    CREATE INDEX idx_role ON users(role);

    -- 3. 프로젝트 인력 배치 테이블: 조인 및 기간 검색(M/M 플래너) 최적화
    CREATE INDEX idx_participants_project_id ON participants(project_id);
    CREATE INDEX idx_participants_user_id ON participants(user_id);
    CREATE INDEX idx_participants_dates ON participants(start_date, end_date);
`;

const insertSeedDataQuery = `
    -- 부서
    INSERT INTO masters (category, code, code_name)
    VALUES
    ('DEPT', 'PLANNING', '경영기획팀'),
    ('DEPT', 'HR', '인사팀'),
    ('DEPT', 'FINANCE', '재무팀'),
    ('DEPT', 'SALES', '영업팀'),
    ('DEPT', 'IT', 'IT팀'),
    ('DEPT', 'MARKETING', '마케팅팀'),
    ('DEPT', 'DESIGN', '디자인팀');

    -- 직급
    INSERT INTO masters (category, code, code_name)
    VALUES
    ('POSITION', 'CEO', '대표'),
    ('POSITION', 'V_PRESIDENT', '부대표'),
    ('POSITION', 'EX_DIRECTOR', '전무'),
    ('POSITION', 'DIRECTOR', '상무'),
    ('POSITION', 'GENERAL_MGR', '부장'),
    ('POSITION', 'DEPUTY_MGR', '차장'),
    ('POSITION', 'MANAGER', '과장'),
    ('POSITION', 'ASSISTANT', '대리'),
    ('POSITION', 'STAFF', '사원');

    -- 직군
    INSERT INTO masters (category, code, code_name)
    VALUES
    ('ROLE', 'PLANNER', '기획'),
    ('ROLE', 'DESIGNER', '디자인'),
    ('ROLE', 'PUBLISHER', '퍼블'),
    ('ROLE', 'DEVELOPER', '개발');

    -- 등급
    INSERT INTO masters (category, code, code_name)
    VALUES
    ('LEVEL', 'JUNIOR', '초급'),
    ('LEVEL', 'MID', '중급'),
    ('LEVEL', 'SENIOR', '고급'),
    ('LEVEL', 'EXPERT', '특급');

    -- 유저 (총 50명)
    -- 비밀번호는 전부 '$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86'로 일치!
    INSERT INTO users (email, password, auth, name, phone, dept, role, level, position, monthly_cost, status, is_approved, note)
    VALUES
    -- 1. SUPERADMIN (관리자)
    ('admin','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','SUPERADMIN','최고관리자','010-0000-0000','PLANNING','PLANNER','EXPERT','CEO',8000000,'ACTIVE',TRUE,'시스템 총괄 / 대표'),

    -- HR 부서장 (ADMIN 2명)
    ('hr.mgr1@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','ADMIN','김인사','010-1001-0001','HR','PLANNER','SENIOR','DEPUTY_MGR',4000000,'ACTIVE',TRUE,'인사팀 차장 / 파트장'),
    ('hr.mgr2@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','ADMIN','박노무','010-1001-0002','HR','PLANNER','EXPERT','GENERAL_MGR',4800000,'ACTIVE',TRUE,'인사팀 부장 / 본부장'),

    -- FINANCE 부서장 (ADMIN 2명)
    ('finance.mgr1@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','ADMIN','이재무','010-1002-0001','FINANCE','PLANNER','SENIOR','DEPUTY_MGR',4200000,'ACTIVE',TRUE,'재무팀 차장 / 팀장'),
    ('finance.mgr2@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','ADMIN','최회계','010-1002-0002','FINANCE','PLANNER','EXPERT','DIRECTOR',5500000,'ACTIVE',TRUE,'재무본부 상무 / CFO'),

    -- SALES 부서장 (ADMIN 2명)
    ('sales.mgr1@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','ADMIN','박영업','010-1003-0001','SALES','PLANNER','SENIOR','DEPUTY_MGR',4300000,'ACTIVE',TRUE,'영업팀 차장 / 팀장'),
    ('sales.mgr2@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','ADMIN','정수출','010-1003-0002','SALES','PLANNER','EXPERT','GENERAL_MGR',4900000,'ACTIVE',TRUE,'영업팀 부장 / 본부장'),

    -- MARKETING 부서장 (ADMIN 2명)
    ('marketing.mgr1@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','ADMIN','최마케','010-1004-0001','MARKETING','PLANNER','SENIOR','DEPUTY_MGR',4100000,'ACTIVE',TRUE,'마케팅팀 차장 / 팀장'),
    ('marketing.mgr2@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','ADMIN','윤광고','010-1004-0002','MARKETING','PLANNER','EXPERT','DIRECTOR',5400000,'ACTIVE',TRUE,'마케팅본부 상무 / CMO'),

    -- DESIGN 부서장 (ADMIN 2명)
    ('design.mgr1@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','ADMIN','강디자인','010-1005-0001','DESIGN','DESIGNER','SENIOR','DEPUTY_MGR',4200000,'ACTIVE',TRUE,'디자인팀 차장 / UI파트장'),
    ('design.mgr2@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','ADMIN','신미술','010-1005-0002','DESIGN','DESIGNER','EXPERT','EX_DIRECTOR',6200000,'ACTIVE',TRUE,'디자인본부 전무 / CDO'),

    -- IT 부서장 (ADMIN 2명)
    ('it.mgr1@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','ADMIN','정IT','010-1006-0001','IT','DEVELOPER','SENIOR','DEPUTY_MGR',4600000,'ACTIVE',TRUE,'IT팀 차장 / 개발팀장'),
    ('it.mgr2@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','ADMIN','한코딩','010-1006-0002','IT','DEVELOPER','EXPERT','DIRECTOR',5800000,'ACTIVE',TRUE,'IT본부 상무 / CTO'),

    -- PLANNING 부서장 (ADMIN 2명)
    ('planning.mgr1@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','ADMIN','오기획','010-1007-0001','PLANNING','PLANNER','SENIOR','DEPUTY_MGR',4400000,'ACTIVE',TRUE,'기획팀 차장 / 팀장'),
    ('planning.mgr2@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','ADMIN','임전략','010-1007-0002','PLANNING','PLANNER','EXPERT','EX_DIRECTOR',6000000,'ACTIVE',TRUE,'기획본부 전무 / CSO'),

    -- 일반 사원 (USER 35명) - 다양한 부서, 등급, 이름, 단가 배정 (마스터 직급 코드와 한글 일치!)
    ('user16@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','김기획','010-1000-0016','HR','PLANNER','JUNIOR','STAFF',2500000,'ACTIVE',TRUE,'인사팀 사원 (김기획 선임)'),
    ('user17@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','이설계','010-1000-0017','HR','PLANNER','MID','ASSISTANT',3000000,'ACTIVE',TRUE,'인사팀 대리 (이설계 책임)'),
    ('user18@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','유재석','010-1000-0018','FINANCE','PLANNER','MID','MANAGER',3500000,'ACTIVE',TRUE,'재무팀 과장'),
    ('user19@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','송은이','010-1000-0019','FINANCE','PLANNER','SENIOR','DEPUTY_MGR',4200000,'ACTIVE',TRUE,'재무팀 차장'),
    ('user20@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','이동욱','010-1000-0020','SALES','PUBLISHER','JUNIOR','STAFF',2400000,'ACTIVE',TRUE,'영업팀 사원'),
    ('user21@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','한효주','010-1000-0021','SALES','PUBLISHER','MID','ASSISTANT',2900000,'ACTIVE',TRUE,'영업팀 대리'),
    ('user22@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','공유','010-1000-0022','SALES','PUBLISHER','SENIOR','MANAGER',3800000,'ACTIVE',TRUE,'영업팀 과장'),
    ('user23@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','김고은','010-1000-0023','MARKETING','DEVELOPER','JUNIOR','STAFF',2800000,'ACTIVE',TRUE,'마케팅팀 사원'),
    ('user24@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','조인성','010-1000-0024','MARKETING','DEVELOPER','MID','ASSISTANT',3500000,'ACTIVE',TRUE,'마케팅팀 대리'),
    ('user25@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','남주혁','010-1000-0025','MARKETING','DEVELOPER','SENIOR','MANAGER',4500000,'ACTIVE',TRUE,'마케팅팀 과장'),
    ('user26@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','박디잔','010-1000-0026','DESIGN','DESIGNER','JUNIOR','STAFF',2400000,'ACTIVE',TRUE,'디자인팀 사원 (박디잔 선임)'),
    ('user27@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','김선호','010-1000-0027','DESIGN','DESIGNER','MID','ASSISTANT',3000000,'ACTIVE',TRUE,'디자인팀 대리'),
    ('user28@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','신민아','010-1000-0028','DESIGN','DESIGNER','SENIOR','DEPUTY_MGR',4000000,'ACTIVE',TRUE,'디자인팀 차장'),
    ('user29@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','정개발','010-1000-0029','IT','DEVELOPER','SENIOR','MANAGER',4800000,'ACTIVE',TRUE,'IT팀 과장 (정개발 수석)'),
    ('user30@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','강서버','010-1000-0030','IT','DEVELOPER','EXPERT','GENERAL_MGR',5600000,'ACTIVE',TRUE,'IT팀 부장 (강서버 선임)'),
    ('user31@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','송강호','010-1000-0031','IT','DEVELOPER','EXPERT','DIRECTOR',6500000,'ACTIVE',TRUE,'IT팀 상무'),
    ('user32@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','황정민','010-1000-0032','PLANNING','PLANNER','SENIOR','GENERAL_MGR',4800000,'ACTIVE',TRUE,'기획팀 부장'),
    ('user33@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','이병헌','010-1000-0033','PLANNING','PLANNER','EXPERT','V_PRESIDENT',7500000,'ACTIVE',TRUE,'부대표'),
    ('user34@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','손예진','010-1000-0034','IT','PUBLISHER','MID','ASSISTANT',3200000,'ACTIVE',TRUE,'IT팀 대리'),
    ('user35@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','현빈','010-1000-0035','IT','PUBLISHER','SENIOR','MANAGER',3900000,'ACTIVE',TRUE,'IT팀 과장'),
    ('user36@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','유해진','010-1000-0036','IT','DEVELOPER','MID','MANAGER',3500000,'ACTIVE',TRUE,'IT팀 과장'),
    ('user37@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','마동석','010-1000-0037','IT','DEVELOPER','SENIOR','DEPUTY_MGR',4700000,'ACTIVE',TRUE,'IT팀 차장'),
    ('user38@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','박서준','010-1000-0038','DESIGN','DESIGNER','JUNIOR','STAFF',2400000,'ACTIVE',TRUE,'디자인팀 사원'),
    ('user39@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','박보검','010-1000-0039','DESIGN','DESIGNER','MID','ASSISTANT',3000000,'ACTIVE',TRUE,'디자인팀 대리'),
    ('user40@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','한소희','010-1000-0040','DESIGN','DESIGNER','MID','MANAGER',3100000,'ACTIVE',TRUE,'디자인팀 과장'),
    ('user41@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','차은우','010-1000-0041','PLANNING','PLANNER','JUNIOR','STAFF',2500000,'ACTIVE',TRUE,'기획팀 사원'),
    ('user42@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','임윤아','010-1000-0042','PLANNING','PLANNER','MID','ASSISTANT',3100000,'ACTIVE',TRUE,'기획팀 대리'),
    ('user43@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','이도현','010-1000-0043','MARKETING','PLANNER','JUNIOR','STAFF',2300000,'ACTIVE',TRUE,'마케팅팀 사원'),
    ('user44@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','김지원','010-1000-0044','MARKETING','PLANNER','MID','ASSISTANT',3000000,'ACTIVE',TRUE,'마케팅팀 대리'),
    ('user45@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','김수현','010-1000-0045','MARKETING','PLANNER','SENIOR','MANAGER',4000000,'ACTIVE',TRUE,'마케팅팀 과장'),
    ('user46@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','남궁민','010-1000-0046','SALES','PLANNER','SENIOR','DEPUTY_MGR',4200000,'ACTIVE',TRUE,'영업팀 차장'),
    ('user47@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','안은진','010-1000-0047','SALES','PLANNER','JUNIOR','STAFF',2400000,'ACTIVE',TRUE,'영업팀 사원'),
    ('user48@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','조정석','010-1000-0048','HR','PLANNER','SENIOR','DEPUTY_MGR',4100000,'ACTIVE',TRUE,'인사팀 차장'),
    ('user49@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','신혜선','010-1000-0049','HR','PLANNER','MID','ASSISTANT',3000000,'ACTIVE',TRUE,'인사팀 대리'),
    ('user50@fuz.co.kr','$2b$10$qG6mVKuW3g8ZShVxVRfDDeH9.ZBwUl5Wyz4xG8n7tnQ7xCKm0Ch86','USER','지창욱','010-1000-0050','HR','PLANNER','EXPERT','GENERAL_MGR',5000000,'ACTIVE',TRUE,'인사팀 부장 / 시스템지원');

    -- 프로젝트 (총 10개, 기간 3~5달, 2026년 7월 기준)
    INSERT INTO projects (name, client_name, project_type, start_date, end_date, budget, status, required_planner, required_designer, required_publisher, required_developer, required_etc, created_by, dept, note)
    VALUES
    ('A 웹사이트 구축', 'FUZ', '구축', '2026-07-01', '2026-10-31', 150000000, '진행중', 1, 1, 1, 2, 0, 2, 'IT', '회사 공식 홈페이지 개발'),
    ('B 쇼핑몰 고도화', '네이버', '구축', '2026-06-15', '2026-09-15', 80000000, '진행중', 1, 1, 0, 1, 0, 2, 'SALES', '결제 시스템 연동 및 속도 개선'),
    ('C사 ERP 구축', '더존', '구축', '2026-03-01', '2026-07-31', 300000000, '대기', 2, 1, 1, 3, 0, 2, 'FINANCE', '전사 자원 관리 소프트웨어 구축'),
    ('D 모바일 앱 개발', '카카오', '구축', '2026-04-01', '2026-08-30', 90000000, '진행중', 1, 1, 1, 1, 0, 2, 'IT', '고객용 크로스플랫폼 앱 개발'),
    ('E사 시스템 유지보수', '라인', '유지보수', '2026-01-15', '2026-06-15', 120000000, '진행중', 1, 0, 0, 2, 0, 2, 'IT', '시스템 안정성 점검 및 장애 대응'),
    ('F 플랫폼 인프라 이전', '쿠팡', '구축', '2026-05-01', '2026-08-31', 60000000, '대기', 0, 0, 0, 2, 1, 2, 'IT', 'AWS 클라우드 마이그레이션'),
    ('G 그룹웨어 리뉴얼', '배민', '구축', '2026-02-01', '2026-08-31', 180000000, '진행중', 1, 1, 1, 1, 0, 2, 'HR', '사내 인트라넷 UI/UX 개선 및 전자결재 도입'),
    ('H사 AI 챗봇 도입', '토스', '구축', '2026-03-15', '2026-08-15', 75000000, '진행중', 1, 1, 0, 1, 0, 2, 'MARKETING', 'AI 자연어 처리 챗봇 도입 작업'),
    ('I 금융 시스템 차세대', '신한은행', '구축', '2026-01-01', '2026-08-31', 400000000, '진행중', 2, 2, 1, 4, 0, 2, 'FINANCE', '차세대 코어 뱅킹 전면 개편'),
    ('J 사내 인트라넷 구축', 'FUZ', '구축', '2026-04-15', '2026-08-15', 50000000, '대기', 1, 1, 0, 1, 0, 2, 'HR', '임직원 근태 관리 및 M/M 플래너 연동');

    -- 투입인원 (각 프로젝트 날짜 범위에 철저히 속하게 배치! 2024년 기준)
    INSERT INTO participants (project_id, user_id, start_date, end_date, mm_value, monthly_cost, role, level, note)
    VALUES
    -- 프로젝트 1 (A 웹사이트 구축: 2024-08-01 ~ 2024-11-30)
    (1, 16, '2026-07-01', '2026-10-31', 1.0, 2500000, 'PLANNER', 'JUNIOR', '기획 초기 및 안정화 투입 (김기획 선임)'),
    (1, 17, '2026-07-01', '2026-10-31', 0.8, 3000000, 'PLANNER', 'MID', '스펙 조율 및 설계 책임 (이설계 책임)'),
    (1, 26, '2026-07-15', '2026-10-15', 1.0, 2400000, 'DESIGNER', 'JUNIOR', 'UI 디자인 핵심 (박디잔 선임)'),
    (1, 29, '2026-07-01', '2026-10-31', 1.0, 4800000, 'DEVELOPER', 'SENIOR', '메인 프론트엔드 (정개발 수석)'),
    (1, 30, '2026-07-01', '2026-10-31', 2.0, 5600000, 'DEVELOPER', 'EXPERT', '코어 서버 아키텍트 (강서버 선임)'),

    -- 프로젝트 2 (B 쇼핑몰 고도화: 2026-06-15 ~ 2026-09-15) - 강서버 중복 투입 배정!
    (2, 30, '2026-07-01', '2026-08-31', 1.5, 5600000, 'DEVELOPER', 'EXPERT', '결제 모듈 고도화 (강서버 선임)'),
    (2, 16, '2026-07-15', '2026-09-15', 0.5, 2500000, 'PLANNER', 'JUNIOR', '쇼핑몰 고도화 서브 기획'),

    -- 프로젝트 3 (C사 ERP 구축: 2026-03-01 ~ 2026-07-31)
    (3, 32, '2026-03-01', '2026-07-31', 1.0, 4800000, 'PLANNER', 'SENIOR', 'ERP 분석 설계'),
    (3, 28, '2026-03-15', '2026-07-15', 0.5, 4000000, 'DESIGNER', 'SENIOR', 'ERP 화면 프로토타이핑'),
    (3, 36, '2026-04-01', '2026-07-31', 1.0, 3500000, 'DEVELOPER', 'MID', 'ERP 프론트 개발'),

    -- 프로젝트 4 (D 모바일 앱 개발: 2026-04-01 ~ 2026-08-30)
    (4, 41, '2026-04-01', '2026-08-30', 1.0, 2500000, 'PLANNER', 'JUNIOR', '모바일 화면 상세 설계'),
    (4, 39, '2026-04-01', '2026-08-15', 1.0, 3000000, 'DESIGNER', 'MID', '앱 GUI 디자인'),
    (4, 23, '2026-05-01', '2026-08-30', 1.0, 2800000, 'DEVELOPER', 'JUNIOR', 'React Native 앱 개발'),

    -- 프로젝트 5 (E사 시스템 유지보수: 2026-01-15 ~ 2026-06-15)
    (5, 42, '2026-01-15', '2026-06-15', 0.5, 3100000, 'PLANNER', 'MID', '유지보수 요청 관리'),

    -- 프로젝트 6 (F 플랫폼 인프라 이전: 2026-05-01 ~ 2026-08-31)
    (6, 43, '2026-05-01', '2026-08-31', 1.0, 2300000, 'PLANNER', 'JUNIOR', '인프라 문서화'),
    (6, 25, '2026-05-01', '2026-08-31', 1.0, 4500000, 'DEVELOPER', 'SENIOR', 'DevOps 인프라 세팅'),

    -- 프로젝트 7 (G 그룹웨어 리뉴얼: 2026-02-01 ~ 2026-08-31)
    (7, 44, '2026-02-01', '2026-08-31', 1.0, 3000000, 'PLANNER', 'MID', '그룹웨어 요건 정의'),
    (7, 29, '2026-03-01', '2026-08-31', 1.0, 4800000, 'DEVELOPER', 'SENIOR', '그룹웨어 개발'),

    -- 프로젝트 8 (H사 AI 챗봇 도입: 2026-03-15 ~ 2026-08-15)
    (8, 45, '2026-03-15', '2026-08-15', 1.0, 4000000, 'PLANNER', 'SENIOR', '챗봇 시나리오 기획'),
    (8, 34, '2026-04-01', '2026-08-15', 1.0, 3200000, 'DEVELOPER', 'MID', '챗봇 API 연동'),

    -- 프로젝트 9 (I 금융 시스템 차세대: 2026-01-01 ~ 2026-08-31)
    (9, 48, '2026-01-01', '2026-08-31', 1.0, 4100000, 'PLANNER', 'SENIOR', '금융 PL'),
    (9, 31, '2026-02-01', '2026-08-31', 1.0, 6500000, 'DEVELOPER', 'EXPERT', '금융 원장 코어 시스템 개발'),

    -- 프로젝트 10 (J 사내 인트라넷 구축: 2026-04-15 ~ 2026-08-15)
    (10, 49, '2026-04-15', '2026-08-15', 1.0, 3000000, 'PLANNER', 'MID', '사내 시스템 기획'),
    (10, 21, '2026-04-15', '2026-08-15', 0.8, 2900000, 'PUBLISHER', 'MID', '인트라넷 퍼블리싱'),
    (10, 35, '2026-05-01', '2026-08-15', 1.0, 3900000, 'DEVELOPER', 'SENIOR', '인트라넷 프레임워크 구축');


    -- 화면 세부 기능 권한 샘플 (UI 01 유저 목록 화면)
    INSERT INTO screen_permissions (screen_id, feature_code, feature_name, description, allow_admin, allow_user)
    VALUES
    ('DASHBOARD', 'CREATE_PROJECT_BTN', '새 프로젝트 등록', '신규 프로젝트 등록', TRUE, FALSE),
    ('DASHBOARD', 'ALERTBOX', '알림 영역', '알림영역', TRUE, FALSE),

    ('RESOURCE_STATUS', 'ASSIGN_RESOURCE_BTN', '인력배치', '인력배치 버튼', TRUE, FALSE),
    ('RESOURCE_STATUS', 'CREATE_PROJECT_BTN', '새 프로젝트 등록', '신규 프로젝트 등록', TRUE, FALSE),
    ('RESOURCE_STATUS', 'UPDATE_PROJECT_BTN', '프로젝트정보 수정', '프로젝트 수정 버튼', TRUE, FALSE),

    ('USER_LIST', 'BTN_CREATE_USER', '신규 유저 등록 버튼', '신규 직원을 등록하는 버튼', TRUE, FALSE),
    ('USER_LIST', 'COL_MONTHLY_COST', '월 인건비/원가 컬럼', '목록 표 내부의 인건비 원가 컬럼', TRUE, FALSE),
    ('USER_LIST', 'BTN_EXCEL_DOWNLOAD', '엑셀 다운로드 버튼', '유저 목록을 엑셀로 다운받는 버튼', TRUE, TRUE);
`;

async function initDb() {
    try {
        console.log("Dropping schema for full reset...");
        await pool.query(dropTablesQuery);

        console.log("Initializing database tables for M/M Resource Planner...");
        const createAllTables = `
            ${mastersTable}
            ${userTable}
            ${projectsTable}
            ${participantsTable}
            ${screenPermissionsTable}
            /*${indexQueries}*/
            ${insertSeedDataQuery}
        `;
        await pool.query(createAllTables);

        console.log("Database tables initialized and indexed successfully.");
    } catch (error) {
        console.error("Error initializing database tables:", error);
    } finally {
        await pool.end();
    }
}

initDb();

//npx ts-node src/init-db.ts
