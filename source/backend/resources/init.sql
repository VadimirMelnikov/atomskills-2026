CREATE TABLE IF NOT EXISTS departments (
    id               VARCHAR(255) PRIMARY KEY,
    department_title VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS positions (
    short_name VARCHAR(255) PRIMARY KEY,
    full_name  VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id             VARCHAR(255) PRIMARY KEY,
    login          VARCHAR(255) NOT NULL UNIQUE,
    first_name     VARCHAR(255),
    second_name    VARCHAR(255),
    surname        VARCHAR(255),
    sex            BOOLEAN,
    birth_date     DATE,
    department_id  VARCHAR(255) REFERENCES departments(id),
    position_id    VARCHAR(255) REFERENCES positions(short_name),
    manager_id     VARCHAR(255) REFERENCES users(id),
    is_superuser   BOOLEAN NOT NULL DEFAULT false
);


CREATE INDEX IF NOT EXISTS ix_users_full_name ON users (lower(first_name), lower(second_name), lower(surname));

CREATE TABLE IF NOT EXISTS documents (
    id       BIGSERIAL PRIMARY KEY,
    name     VARCHAR(255) NOT NULL,
    owner_id VARCHAR(255) NOT NULL REFERENCES users(id)
);

-- enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('reader', 'commenter', 'writer');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status') THEN
        CREATE TYPE document_status AS ENUM ('draft', 'under_approval', 'approved', 'refusal');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approve_method') THEN
        CREATE TYPE approve_method AS ENUM ('simple', 'strict');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS user_document (
    user_id     VARCHAR(255) NOT NULL REFERENCES users(id),
    document_id BIGINT NOT NULL REFERENCES documents(id),
    user_role   user_role,
    PRIMARY KEY (user_id, document_id)
);


CREATE TABLE IF NOT EXISTS versions (
    id         BIGSERIAL PRIMARY KEY,
    version    INT NOT NULL,
    status     document_status NOT NULL,
    approve_method approve_method NOT NULL DEFAULT 'simple',
    s3_url     VARCHAR(1024) NOT NULL,
    doc_id     BIGINT NOT NULL REFERENCES documents(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approvers (
    user_id            VARCHAR(255) NOT NULL REFERENCES users(id),
    version_id         BIGINT NOT NULL REFERENCES versions(id),
    order_index        INT NOT NULL,
    approved           BOOLEAN,
    reason_for_refusal TEXT,
    PRIMARY KEY (user_id, version_id)
);

-- Суперпользователь (импорт Excel его не перезаписывает и не удаляет при полной замене)
INSERT INTO users (id, login, is_superuser)
SELECT '__superuser__', 'admin', true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = '__superuser__');

-- Демо-отдел и должности (табельный номер = users.id, логин = вход в систему)
INSERT INTO departments (id, department_title)
SELECT '10', 'Отдел разработки и сопровождения ПО'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = '10');

INSERT INTO positions (short_name, full_name)
SELECT 'ruk_gr', 'Руководитель группы разработки'
WHERE NOT EXISTS (SELECT 1 FROM positions WHERE short_name = 'ruk_gr');

INSERT INTO positions (short_name, full_name)
SELECT 'st_ing', 'Инженер-программист'
WHERE NOT EXISTS (SELECT 1 FROM positions WHERE short_name = 'st_ing');

-- Вадим: таб. № 2, руководитель группы (без руководителя в иерархии)
INSERT INTO users (
    id,
    login,
    first_name,
    second_name,
    surname,
    sex,
    birth_date,
    department_id,
    position_id,
    manager_id,
    is_superuser
)
SELECT
    '2',
    'Вадим',
    'Вадим',
    'Игоревич',
    'Козлов',
    true,
    DATE '1986-04-17',
    '10',
    'ruk_gr',
    NULL,
    false
WHERE NOT EXISTS (SELECT 1 FROM users WHERE login = 'Вадим');

-- Андрей: таб. № 1, разработчик, руководитель — Вадим (таб. № 2)
INSERT INTO users (
    id,
    login,
    first_name,
    second_name,
    surname,
    sex,
    birth_date,
    department_id,
    position_id,
    manager_id,
    is_superuser
)
SELECT
    '1',
    'Андрей',
    'Андрей',
    'Павлович',
    'Морозов',
    true,
    DATE '1993-09-08',
    '10',
    'st_ing',
    '2',
    false
WHERE NOT EXISTS (SELECT 1 FROM users WHERE login = 'Андрей');
