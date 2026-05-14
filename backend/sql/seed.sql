\encoding UTF8

-- Seed data for Pet Hospital System
-- Run: psql -U postgres -d pet_hospital -f seed.sql

-- Clear existing data (idempotent re-run)
DELETE FROM account;
DELETE FROM employee;

INSERT INTO employee (name, role, phone) VALUES
    ('Zhang-Guanli', E'管理员', '13800000001'),
    ('Li-Yisheng',   E'医生',   '13800000002'),
    ('Wang-Hushi',   E'护士',   '13800000003');

INSERT INTO account (employee_id, username, password_hash)
SELECT e.employee_id, u.username, u.pwd
FROM (
    VALUES
        (E'管理员', 'admin',   '$2b$12$CiO9okwYRWOo45wX3xjaI.6JuRfhiOs08sIT5zvk9cQQTotj9cSDa'),
        (E'医生',       'doctor1', '$2b$12$ZeNx7QIlsuxYDzSP6Mr1nuXipCXeAMb98AXayHTnKQxpm8Wa8W3eK'),
        (E'护士',       'nurse1',  '$2b$12$ZeNx7QIlsuxYDzSP6Mr1nuXipCXeAMb98AXayHTnKQxpm8Wa8W3eK')
) AS u(role, username, pwd)
JOIN employee e ON e.role = u.role;
