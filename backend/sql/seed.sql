\encoding UTF8

-- Seed data for Pet Hospital System
-- Run: psql -U postgres -d pet_hospital -f seed.sql

INSERT INTO employee (name, role, phone) VALUES
    ('Zhang-Guanli',  '管理员', '13800000001'),
    ('Li-Yisheng',    '医生',   '13800000002'),
    ('Wang-Hushi',    '护士',   '13800000003');

INSERT INTO account (employee_id, username, password_hash) VALUES
    (1, 'admin',   '$2b$12$CiO9okwYRWOo45wX3xjaI.6JuRfhiOs08sIT5zvk9cQQTotj9cSDa'),
    (2, 'doctor1', '$2b$12$ZeNx7QIlsuxYDzSP6Mr1nuXipCXeAMb98AXayHTnKQxpm8Wa8W3eK'),
    (3, 'nurse1',  '$2b$12$ZeNx7QIlsuxYDzSP6Mr1nuXipCXeAMb98AXayHTnKQxpm8Wa8W3eK');
