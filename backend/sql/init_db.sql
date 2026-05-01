-- ============================================================
--  宠物医院诊疗与住院管理系统 · 建表脚本
--  数据库：PostgreSQL 14+
--  共 15 张表，满足第三范式（3NF）
-- ============================================================

CREATE DATABASE pet_hospital ENCODING 'UTF8';

-- 连接数据库后执行以下语句
-- \c pet_hospital

-- ------------------------------------------------------------
-- 模块一：基础档案（2张表）
-- ------------------------------------------------------------

-- 1. 客户表（宠物主人）
CREATE TABLE customer (
    customer_id SERIAL       PRIMARY KEY,
    name        VARCHAR(50)  NOT NULL,
    phone       VARCHAR(20)  NOT NULL,
    address     VARCHAR(200),
    CONSTRAINT uq_customer_phone UNIQUE (phone)
);

COMMENT ON TABLE  customer             IS '客户（宠物主人）';
COMMENT ON COLUMN customer.customer_id IS '客户编号';
COMMENT ON COLUMN customer.name        IS '姓名';
COMMENT ON COLUMN customer.phone       IS '联系电话';
COMMENT ON COLUMN customer.address     IS '地址';

-- 2. 宠物表
CREATE TABLE pet (
    pet_id      SERIAL      PRIMARY KEY,
    customer_id INT         NOT NULL,
    name        VARCHAR(50) NOT NULL,
    species     VARCHAR(30) NOT NULL,
    breed       VARCHAR(50),
    birth_date  DATE,
    CONSTRAINT fk_pet_customer FOREIGN KEY (customer_id)
        REFERENCES customer(customer_id)
);

COMMENT ON TABLE  pet             IS '宠物信息';
COMMENT ON COLUMN pet.pet_id      IS '宠物编号';
COMMENT ON COLUMN pet.customer_id IS '所属客户';
COMMENT ON COLUMN pet.species     IS '物种（犬/猫/兔等）';
COMMENT ON COLUMN pet.breed       IS '品种';
COMMENT ON COLUMN pet.birth_date  IS '出生日期';

-- ------------------------------------------------------------
-- 模块二：诊疗与认证（4张表）
-- ------------------------------------------------------------

-- 3. 员工表（医生 / 护士 / 管理员）
CREATE TABLE employee (
    employee_id SERIAL      PRIMARY KEY,
    name        VARCHAR(50) NOT NULL,
    role        VARCHAR(20) NOT NULL,
    phone       VARCHAR(20) NOT NULL,
    CONSTRAINT uq_employee_phone UNIQUE (phone)
);

COMMENT ON TABLE  employee             IS '员工';
COMMENT ON COLUMN employee.employee_id IS '员工编号';
COMMENT ON COLUMN employee.role        IS '角色：医生/护士/管理员';

-- 4. 账号表（登录认证，与 employee 一对一）
CREATE TABLE account (
    account_id    SERIAL       PRIMARY KEY,
    employee_id   INT          NOT NULL,
    username      VARCHAR(50)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login    TIMESTAMP,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_account_employee UNIQUE (employee_id),
    CONSTRAINT uq_account_username UNIQUE (username),
    CONSTRAINT fk_account_employee FOREIGN KEY (employee_id)
        REFERENCES employee(employee_id)
);

COMMENT ON TABLE  account               IS '登录账号';
COMMENT ON COLUMN account.account_id    IS '账号编号';
COMMENT ON COLUMN account.employee_id   IS '关联员工（一对一）';
COMMENT ON COLUMN account.username      IS '登录用户名';
COMMENT ON COLUMN account.password_hash IS 'bcrypt 哈希值，禁止存明文';
COMMENT ON COLUMN account.is_active     IS '账号是否启用，禁用后无法登录';
COMMENT ON COLUMN account.last_login    IS '最近登录时间';
COMMENT ON COLUMN account.created_at    IS '创建时间';

-- 5. 就诊记录表
CREATE TABLE visit (
    visit_id    SERIAL      PRIMARY KEY,
    pet_id      INT         NOT NULL,
    employee_id INT         NOT NULL,
    visit_time  TIMESTAMP   NOT NULL DEFAULT NOW(),
    complaint   VARCHAR(500),
    status      VARCHAR(20) NOT NULL DEFAULT '待接诊',
    CONSTRAINT fk_visit_pet      FOREIGN KEY (pet_id)
        REFERENCES pet(pet_id),
    CONSTRAINT fk_visit_employee FOREIGN KEY (employee_id)
        REFERENCES employee(employee_id),
    CONSTRAINT chk_visit_status CHECK (status IN ('待接诊','接诊中','待收费','已完成','已取消'))
);

COMMENT ON TABLE  visit            IS '就诊记录';
COMMENT ON COLUMN visit.complaint  IS '主诉';
COMMENT ON COLUMN visit.status     IS '状态：待接诊/接诊中/待收费/已完成/已取消（门诊与住院解耦，住院状态由 hospitalization 表独立管理）';

-- 6. 诊断记录表
CREATE TABLE diagnosis (
    diagnosis_id     SERIAL       PRIMARY KEY,
    visit_id         INT          NOT NULL,
    diagnosis_result VARCHAR(200) NOT NULL,
    notes            TEXT,
    CONSTRAINT uq_diagnosis_visit  UNIQUE (visit_id),
    CONSTRAINT fk_diagnosis_visit  FOREIGN KEY (visit_id)
        REFERENCES visit(visit_id)
);

COMMENT ON TABLE  diagnosis                  IS '诊断记录';
COMMENT ON COLUMN diagnosis.diagnosis_result IS '诊断结论';
COMMENT ON COLUMN diagnosis.notes            IS '医嘱备注';

-- ------------------------------------------------------------
-- 模块三：住院护理（3张表）
-- ------------------------------------------------------------

-- 7. 病房 / 笼位表（含每日费率，消除 boarding 中的传递依赖）
CREATE TABLE ward (
    ward_id    SERIAL       PRIMARY KEY,
    ward_no    VARCHAR(20)  NOT NULL,
    type       VARCHAR(20)  NOT NULL,
    status     VARCHAR(20)  NOT NULL DEFAULT '空闲',
    daily_rate NUMERIC(8,2) NOT NULL,
    CONSTRAINT uq_ward_no       UNIQUE (ward_no),
    CONSTRAINT chk_ward_rate    CHECK  (daily_rate >= 0)
);

COMMENT ON TABLE  ward            IS '病房/笼位';
COMMENT ON COLUMN ward.ward_no    IS '笼位编号（如 A01）';
COMMENT ON COLUMN ward.type       IS '类型：普通病房/ICU/寄养笼';
COMMENT ON COLUMN ward.status     IS '状态：空闲/占用';
COMMENT ON COLUMN ward.daily_rate IS '每日费率（元）';

-- 8. 住院记录表
CREATE TABLE hospitalization (
    hosp_id        SERIAL PRIMARY KEY,
    visit_id       INT    NOT NULL,
    ward_id        INT    NOT NULL,
    admit_date     DATE         NOT NULL,
    discharge_date DATE,
    status         VARCHAR(20)  NOT NULL DEFAULT '住院中',
    CONSTRAINT uq_hosp_visit  UNIQUE (visit_id),
    CONSTRAINT fk_hosp_visit  FOREIGN KEY (visit_id)
        REFERENCES visit(visit_id),
    CONSTRAINT fk_hosp_ward   FOREIGN KEY (ward_id)
        REFERENCES ward(ward_id),
    CONSTRAINT chk_hosp_status CHECK (status IN ('住院中','已出院'))
);

COMMENT ON TABLE  hospitalization                IS '住院记录';
COMMENT ON COLUMN hospitalization.admit_date     IS '入院日期';
COMMENT ON COLUMN hospitalization.discharge_date IS '出院日期';
COMMENT ON COLUMN hospitalization.status         IS '状态：住院中/已出院（独立管理住院生命周期，不与 visit.status 耦合）';

-- 9. 护理记录表
CREATE TABLE nursing_record (
    record_id   SERIAL    PRIMARY KEY,
    hosp_id     INT       NOT NULL,
    employee_id INT       NOT NULL,
    record_time TIMESTAMP NOT NULL DEFAULT NOW(),
    content     TEXT      NOT NULL,
    CONSTRAINT fk_nursing_hosp     FOREIGN KEY (hosp_id)
        REFERENCES hospitalization(hosp_id),
    CONSTRAINT fk_nursing_employee FOREIGN KEY (employee_id)
        REFERENCES employee(employee_id)
);

COMMENT ON TABLE  nursing_record             IS '护理记录';
COMMENT ON COLUMN nursing_record.record_time IS '护理时间';
COMMENT ON COLUMN nursing_record.content     IS '护理内容';

-- ------------------------------------------------------------
-- 模块四：药品库存（2张表）
-- ------------------------------------------------------------

-- 10. 药品档案表
CREATE TABLE medicine (
    medicine_id SERIAL       PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    unit        VARCHAR(20)  NOT NULL,
    unit_price  NUMERIC(8,2) NOT NULL,
    category    VARCHAR(50)  NOT NULL,
    CONSTRAINT chk_med_price CHECK (unit_price >= 0)
);

COMMENT ON TABLE  medicine            IS '药品档案';
COMMENT ON COLUMN medicine.unit       IS '单位（片/支/ml）';
COMMENT ON COLUMN medicine.unit_price IS '零售单价（元）';
COMMENT ON COLUMN medicine.category   IS '分类（抗生素/消炎/疫苗等）';

-- 11. 药品批次表（进销存核心）
CREATE TABLE medicine_batch (
    batch_id    SERIAL       PRIMARY KEY,
    medicine_id INT          NOT NULL,
    in_date     DATE         NOT NULL,
    expire_date DATE         NOT NULL,
    stock_qty   INT          NOT NULL DEFAULT 0,
    cost_price  NUMERIC(8,2) NOT NULL,
    CONSTRAINT fk_batch_medicine FOREIGN KEY (medicine_id)
        REFERENCES medicine(medicine_id),
    CONSTRAINT chk_batch_qty  CHECK (stock_qty  >= 0),
    CONSTRAINT chk_batch_cost CHECK (cost_price >= 0),
    CONSTRAINT chk_batch_date CHECK (expire_date > in_date)
);

COMMENT ON TABLE  medicine_batch             IS '药品批次';
COMMENT ON COLUMN medicine_batch.in_date     IS '入库日期';
COMMENT ON COLUMN medicine_batch.expire_date IS '有效期至';
COMMENT ON COLUMN medicine_batch.stock_qty   IS '当前库存量';
COMMENT ON COLUMN medicine_batch.cost_price  IS '批次进货单价（元）';

-- 12. 处方明细表（依赖 diagnosis 与 medicine_batch，放在两者之后）（库存扣减由后端 service 层控制）
CREATE TABLE prescription_item (
    item_id      SERIAL      PRIMARY KEY,
    diagnosis_id INT         NOT NULL,
    batch_id     INT         NOT NULL,
    quantity     INT         NOT NULL,
    dosage       VARCHAR(100),
    CONSTRAINT fk_rx_diagnosis FOREIGN KEY (diagnosis_id)
        REFERENCES diagnosis(diagnosis_id),
    CONSTRAINT fk_rx_batch     FOREIGN KEY (batch_id)
        REFERENCES medicine_batch(batch_id),
    CONSTRAINT chk_rx_qty CHECK (quantity > 0)
);

COMMENT ON TABLE  prescription_item          IS '处方明细';
COMMENT ON COLUMN prescription_item.quantity IS '数量';
COMMENT ON COLUMN prescription_item.dosage   IS '用法用量';

-- ------------------------------------------------------------
-- 模块五：寄养（1张表）
-- ------------------------------------------------------------

-- 13. 寄养记录表（daily_rate 已移至 ward，此处无需冗余存储）
CREATE TABLE boarding (
    boarding_id SERIAL PRIMARY KEY,
    pet_id      INT    NOT NULL,
    ward_id     INT    NOT NULL,
    start_date  DATE   NOT NULL,
    end_date    DATE,
    CONSTRAINT fk_boarding_pet  FOREIGN KEY (pet_id)
        REFERENCES pet(pet_id),
    CONSTRAINT fk_boarding_ward FOREIGN KEY (ward_id)
        REFERENCES ward(ward_id)
);

COMMENT ON TABLE  boarding            IS '寄养记录';
COMMENT ON COLUMN boarding.start_date IS '开始日期';
COMMENT ON COLUMN boarding.end_date   IS '结束日期（NULL = 寄养中）';

-- ------------------------------------------------------------
-- 模块六：收费结算（2张表）
-- ------------------------------------------------------------

-- 14. 账单主表（total_amount 已删除，改由视图 v_bill_total 动态汇总）
CREATE TABLE bill (
    bill_id    SERIAL      PRIMARY KEY,
    visit_id   INT         NOT NULL,
    status     VARCHAR(20) NOT NULL DEFAULT '未结清',
    created_at TIMESTAMP   NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_bill_visit  UNIQUE (visit_id),
    CONSTRAINT fk_bill_visit  FOREIGN KEY (visit_id)
        REFERENCES visit(visit_id)
);

COMMENT ON TABLE  bill            IS '账单';
COMMENT ON COLUMN bill.status     IS '状态：未结清/已结清';
COMMENT ON COLUMN bill.created_at IS '开单时间';

-- 15. 账单明细表
CREATE TABLE bill_item (
    bill_item_id SERIAL       PRIMARY KEY,
    bill_id      INT          NOT NULL,
    item_type    VARCHAR(30)  NOT NULL,
    source_type  VARCHAR(20)  NOT NULL,
    source_id    INT          NOT NULL,
    description  VARCHAR(200),
    amount       NUMERIC(8,2) NOT NULL,
    CONSTRAINT fk_bill_item_bill FOREIGN KEY (bill_id)
        REFERENCES bill(bill_id),
    CONSTRAINT chk_item_amount    CHECK (amount >= 0),
    CONSTRAINT uq_bill_item_source UNIQUE (bill_id, source_type, source_id)
);

COMMENT ON TABLE  bill_item              IS '账单明细';
COMMENT ON COLUMN bill_item.item_type    IS '费用类型：诊疗费/药品费/住院费/寄养费';
COMMENT ON COLUMN bill_item.source_type  IS '来源类型：diagnosis/prescription/hospitalization/boarding';
COMMENT ON COLUMN bill_item.source_id    IS '来源记录主键（与 source_type 组合保证幂等，防止重复收费）';
COMMENT ON COLUMN bill_item.amount       IS '金额（元）';

-- ============================================================
--  视图：账单总金额
--  替代原 bill.total_amount 字段，动态聚合保证数据一致性
-- ============================================================

CREATE OR REPLACE VIEW v_bill_total AS
SELECT
    b.bill_id,
    b.visit_id,
    b.status,
    b.created_at,
    COALESCE(SUM(i.amount), 0) AS total_amount
FROM bill b
LEFT JOIN bill_item i ON b.bill_id = i.bill_id
GROUP BY b.bill_id, b.visit_id, b.status, b.created_at;

COMMENT ON VIEW v_bill_total IS '账单总金额视图，动态聚合 bill_item';

-- ============================================================
--  库存扣减说明
--  不再使用数据库触发器，改为后端 service 层使用
--  SELECT ... FOR UPDATE 行级锁控制并发，CHECK (stock_qty >= 0) 作为最后防线
-- ============================================================

-- ============================================================
--  典型业务查询
-- ============================================================

-- 查询某宠物全部就诊历史（含诊断）
-- SELECT v.visit_id, v.visit_time, v.complaint,
--        e.name AS doctor,
--        d.diagnosis_result, d.notes
-- FROM visit v
-- JOIN employee  e ON v.employee_id = e.employee_id
-- LEFT JOIN diagnosis d ON v.visit_id = d.visit_id
-- WHERE v.pet_id = 1
-- ORDER BY v.visit_time DESC;

-- 查询账单总金额（使用视图）
-- SELECT * FROM v_bill_total WHERE bill_id = 1;

-- 计算寄养费用（PostgreSQL 日期直接相减得天数）
-- SELECT b.boarding_id,
--        p.name                                                           AS pet_name,
--        w.ward_no,
--        w.daily_rate,
--        (COALESCE(b.end_date, CURRENT_DATE) - b.start_date)             AS days,
--        w.daily_rate * (COALESCE(b.end_date, CURRENT_DATE) - b.start_date) AS total_fee
-- FROM boarding b
-- JOIN pet  p ON b.pet_id  = p.pet_id
-- JOIN ward w ON b.ward_id = w.ward_id;

-- 查询库存不足的批次（库存 < 10）
-- SELECT m.name AS medicine_name, mb.batch_id, mb.expire_date, mb.stock_qty
-- FROM medicine_batch mb
-- JOIN medicine m ON mb.medicine_id = m.medicine_id
-- WHERE mb.stock_qty < 10
-- ORDER BY mb.stock_qty;

-- 按费用类型统计某月收入
-- SELECT bi.item_type, SUM(bi.amount) AS total_revenue
-- FROM bill_item bi
-- JOIN bill b ON bi.bill_id = b.bill_id
-- WHERE b.created_at BETWEEN '2025-01-01' AND '2025-01-31'
-- GROUP BY bi.item_type
-- ORDER BY total_revenue DESC;
