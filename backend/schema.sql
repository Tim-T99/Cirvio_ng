-- CREATE TABLE employees (
--     id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
--     company_id UUID,
--     department_id UUID,
--     team_id UUID,
--     first_name VARCHAR(100) NOT NULL,
--     middle_name VARCHAR(100),
--     last_name VARCHAR(100) NOT NULL,
--     email VARCHAR(255),
--     phone VARCHAR(20),
--     role VARCHAR(50),
--     employment_type VARCHAR(50),
--     status VARCHAR(50),
--     joined_at DATE,
--     created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- CREATE TABLE user_roles (
-- role_id int,
-- role VARCHAR(255)
-- )

-- ALTER TABLE user_roles
-- ALTER COLUMN role_id PRIMARY KEY DEFAULT INT;

-- INSERT INTO user_roles (role_id, role) 
-- VALUES
-- (0, 'super_admin'), 
-- (1, 'admin'), 
-- (2, 'manager'), 
-- (3, 'employee');

-- ALTER TABLE user_roles
-- ADD PRIMARY KEY (role_id);

-- ALTER TABLE employees
-- ALTER COLUMN role TYPE INTEGER
-- USING role::integer;

-- ALTER TABLE employees
-- ADD CONSTRAINT role
-- FOREIGN KEY (role)
-- REFERENCES user_roles(role_id);

-- CREATE TABLE admins (
--     id              UUID            DEFAULT uuid_generate_v4() PRIMARY KEY,
--     role         	INT             NOT NULL DEFAULT 1,
--     first_name      VARCHAR(255)    NOT NULL,
--     middle_name     VARCHAR(255),
--     last_name       VARCHAR(255)    NOT NULL,
--     email           VARCHAR(255)    NOT NULL UNIQUE,
--     phone           VARCHAR(20)     NOT NULL,
--     status          VARCHAR(50),
--     company_id      UUID,
--     department_id   UUID,
--     team_id         UUID,
--     employment_type VARCHAR(50),
--     password        VARCHAR(255)    NOT NULL,
--     created_at      TIMESTAMPTZ     DEFAULT NOW(),
--     updated_at      TIMESTAMPTZ,

--     CONSTRAINT fk_role FOREIGN KEY (role) REFERENCES user_roles(role_id)
-- );

-- ALTER TABLE employees 
-- ADD password VARCHAR(255) NOT NULL

-- ALTER TABLE employees
-- ADD sector VARCHAR(255) NOT NULL

-- CREATE TABLE COMPANIES (
-- id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
-- name VARCHAR(255) NOT NULL,
-- sector VARCHAR(255) NOT NULL,
-- email VARCHAR(255) NOT NULL,
-- phone VARCHAR(20) NOT NULL,
-- address VARCHAR(255) NOT NULL, 
-- location VARCHAR(255),
-- website VARCHAR(255),
-- contact_name VARCHAR(255) NOT NULL,
-- contact_email VARCHAR(255) NOT NULL,
-- contact_phone VARCHAR(20) NOT NULL
-- )

-- ALTER TABLE employees 
-- ADD CONSTRAINT fk_company_id FOREIGN KEY (company_id) REFERENCES companies(id);

-- ALTER TABLE admins
-- ADD CONSTRAINT fk_company_id FOREIGN KEY (company_id) REFERENCES companies(id)

-- CREATE TABLE managers (
-- id UUID DEFAULT uuid_generate_v4() PRIMARY KEY ,
-- first_name VARCHAR(255) NOT NULL,
-- middle_name VARCHAR(255),
-- last_name VARCHAR(255) NOT NULL,
-- email VARCHAR(255) NOT NULL,
-- phone VARCHAR(255) NOT NULL,
-- status VARCHAR(255) NOT NULL,
-- company_id UUID NOT NULL,
-- CONSTRAINT fk_company_id FOREIGN KEY (company_id) REFERENCES companies(id),
-- created_at TIMESTAMPTZ DEFAULT NOW(),
-- updated_at TIMESTAMPTZ
-- );


                                -- //Cleaned up version//
                                
-- ============================================================
-- EXTENSIONS
-- ============================================================

-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- USER ROLES
-- ============================================================

-- CREATE TABLE user_roles (
--     role_id INT         PRIMARY KEY,
--     role    VARCHAR(255)
-- );

-- INSERT INTO user_roles (role_id, role)
-- VALUES
--     (0, 'super_admin'),
--     (1, 'admin'),
--     (2, 'manager'),
--     (3, 'employee');


-- ============================================================
-- COMPANIES
-- ============================================================

CREATE TABLE companies (
    id            UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    sector        VARCHAR(255) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    phone         VARCHAR(20)  NOT NULL,
    address       VARCHAR(255) NOT NULL,
    location      VARCHAR(255),
    website       VARCHAR(255),
    contact_name  VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20)  NOT NULL
);


-- ============================================================
-- EMPLOYEES
-- ============================================================

CREATE TABLE employees (
    id              UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id      UUID                                             REFERENCES companies(id),
    department_id   UUID,
    team_id         UUID,
    first_name      VARCHAR(100) NOT NULL,
    middle_name     VARCHAR(100),
    last_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(255),
    phone           VARCHAR(20),
    role            INT                                              REFERENCES user_roles(role_id),
    employment_type VARCHAR(50),
    status          VARCHAR(50),
    sector          VARCHAR(255) NOT NULL,
    password        VARCHAR(255) NOT NULL,
    joined_at       DATE,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);


-- ============================================================
-- ADMINS
-- ============================================================

CREATE TABLE admins (
    id              UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
    role            INT          NOT NULL DEFAULT 1                  REFERENCES user_roles(role_id),
    first_name      VARCHAR(255) NOT NULL,
    middle_name     VARCHAR(255),
    last_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    phone           VARCHAR(20)  NOT NULL,
    status          VARCHAR(50),
    company_id      UUID                                             REFERENCES companies(id),
    department_id   UUID,
    team_id         UUID,
    employment_type VARCHAR(50),
    password        VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);


-- ============================================================
-- MANAGERS
-- ============================================================

CREATE TABLE managers (
    id          UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
    first_name  VARCHAR(255) NOT NULL,
    middle_name VARCHAR(255),
    last_name   VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL,
    phone       VARCHAR(255) NOT NULL,
    status      VARCHAR(255) NOT NULL,
    company_id  UUID         NOT NULL                               REFERENCES companies(id),
    created_at  TIMESTAMPTZ  DEFAULT NOW(),
    updated_at  TIMESTAMPTZ
);