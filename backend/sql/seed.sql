-- ============================================================
--  宠物医院管理系统 · 初始种子数据
--  执行方式：psql -U postgres -d pet_hospital -f seed.sql
-- ============================================================

-- ------------------------------------------------------------
-- 员工（3个角色各1人）
-- ------------------------------------------------------------
INSERT INTO employee (name, role, phone) VALUES
    ('张管理', '管理员', '13800000001'),
    ('李医生', '医生',   '13800000002'),
    ('王护士', '护士',   '13800000003');

-- ------------------------------------------------------------
-- 账号（密码均已 bcrypt 哈希）
-- ------------------------------------------------------------
INSERT INTO account (employee_id, username, password_hash) VALUES
    (1, 'admin',   '$2b$12$CiO9okwYRWOo45wX3xjaI.6JuRfhiOs08sIT5zvk9cQQTotj9cSDa'),   -- admin123
    (2, 'doctor1', '$2b$12$ZeNx7QIlsuxYDzSP6Mr1nuXipCXeAMb98AXayHTnKQxpm8Wa8W3eK'),   -- test123456
    (3, 'nurse1',  '$2b$12$ZeNx7QIlsuxYDzSP6Mr1nuXipCXeAMb98AXayHTnKQxpm8Wa8W3eK');   -- test123456
