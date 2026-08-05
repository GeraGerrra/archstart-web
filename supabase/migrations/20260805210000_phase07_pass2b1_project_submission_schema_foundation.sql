-- ARCH.START Phase 07 Pass 2B1 — Project submission schema foundation
-- Database-only foundation for project submissions, immutable versions,
-- file metadata, reviewer authority, rubric snapshots, reviews, and status
-- history. No Storage bucket, upload endpoint, learner/reviewer UI, email,
-- certificate, or public workflow RPC is activated in this pass.

begin;

-- ---------------------------------------------------------------------------
-- Accepted predecessor and clean-boundary preflight
-- ---------------------------------------------------------------------------

do $$
declare
  module_count integer;
  lesson_count integer;
  project_count integer;
  completion_rls boolean;
begin
  if to_regclass('private.course_modules') is null
    or to_regclass('private.course_lessons') is null
    or to_regclass('private.course_projects') is null
    or to_regclass('public.lesson_activity') is null
    or to_regclass('public.quiz_attempts') is null
    or to_regclass('public.lesson_completions') is null
    or to_regclass('public.module_completions') is null
  then
    raise exception using
      errcode = '55000',
      message = 'Accepted Phase 07 Pass 1A–1E foundations are required';
  end if;

  select count(*) into module_count
  from private.course_modules;

  select count(*) into lesson_count
  from private.course_lessons;

  select count(*) into project_count
  from private.course_projects;

  select relrowsecurity into completion_rls
  from pg_class
  where oid = 'public.lesson_completions'::regclass;

  if module_count <> 8
    or lesson_count <> 40
    or project_count <> 8
    or completion_rls is not true
    or not has_schema_privilege('service_role', 'private', 'USAGE')
  then
    raise exception using
      errcode = '55000',
      message = 'Accepted hosted Phase 07 identity is invalid';
  end if;

  if to_regclass('private.project_submission_policies') is not null
    or to_regclass('private.project_rubric_criteria') is not null
    or to_regclass('private.project_staff_roles') is not null
    or to_regclass('private.project_reviewer_assignments') is not null
    or to_regclass('public.project_submissions') is not null
    or to_regclass('public.project_submission_versions') is not null
    or to_regclass('public.project_submission_files') is not null
    or to_regclass('public.project_reviews') is not null
    or to_regclass('public.project_review_criteria') is not null
    or to_regclass('public.project_status_events') is not null
  then
    raise exception using
      errcode = '42P07',
      message = 'Phase 07 Pass 2B1 project foundation already exists';
  end if;

  if to_regclass('storage.buckets') is not null
    and exists (
      select 1
      from storage.buckets
      where id = 'project-submissions'
    )
  then
    raise exception using
      errcode = '55000',
      message = 'project-submissions Storage bucket must not pre-exist Pass 2C';
  end if;
end;
$$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- ---------------------------------------------------------------------------
-- Immutable private policy and rubric catalogs
-- ---------------------------------------------------------------------------

create table private.project_submission_policies (
  project_code text not null
    references private.course_projects(project_code)
    on update cascade
    on delete restrict,
  policy_version smallint not null,
  content_version text not null,
  format_type text not null,
  allowed_mime_types text[] not null,
  max_file_bytes bigint not null,
  primary_file_count smallint not null,
  expected_width integer not null,
  expected_height integer not null,
  min_page_count smallint not null,
  max_page_count smallint not null,
  supporting_text_min_words smallint not null,
  supporting_text_max_words smallint not null,
  rubric_version smallint not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (project_code, policy_version),
  constraint project_submission_policy_version_positive
    check (policy_version > 0 and rubric_version > 0),
  constraint project_submission_policy_content_version
    check (char_length(content_version) between 1 and 120),
  constraint project_submission_policy_format
    check (format_type in ('SINGLE_BOARD', 'MULTI_PAGE_PACK')),
  constraint project_submission_policy_mime_types
    check (
      cardinality(allowed_mime_types) between 1 and 2
      and allowed_mime_types <@ array[
        'application/pdf',
        'image/png'
      ]::text[]
    ),
  constraint project_submission_policy_file_limit
    check (max_file_bytes between 1 and 41943040),
  constraint project_submission_policy_one_file
    check (primary_file_count = 1),
  constraint project_submission_policy_canvas
    check (expected_width = 1920 and expected_height = 1080),
  constraint project_submission_policy_pages
    check (
      min_page_count >= 1
      and max_page_count >= min_page_count
      and (
        (
          format_type = 'SINGLE_BOARD'
          and min_page_count = 1
          and max_page_count = 1
        )
        or (
          format_type = 'MULTI_PAGE_PACK'
          and min_page_count >= 2
        )
      )
    ),
  constraint project_submission_policy_supporting_text
    check (
      supporting_text_min_words >= 0
      and supporting_text_max_words >= supporting_text_min_words
    )
);

create unique index project_submission_policy_one_current_idx
on private.project_submission_policies (project_code)
where is_current;

create table private.project_rubric_criteria (
  project_code text not null
    references private.course_projects(project_code)
    on update cascade
    on delete restrict,
  rubric_version smallint not null,
  criterion_number smallint not null,
  title text not null,
  description text not null,
  max_points smallint not null,
  created_at timestamptz not null default now(),
  primary key (project_code, rubric_version, criterion_number),
  constraint project_rubric_criterion_number
    check (criterion_number between 1 and 5),
  constraint project_rubric_title_length
    check (char_length(title) between 1 and 300),
  constraint project_rubric_description_length
    check (char_length(description) between 1 and 2000),
  constraint project_rubric_points
    check (max_points between 1 and 100)
);

insert into private.project_submission_policies (
  project_code,
  policy_version,
  content_version,
  format_type,
  allowed_mime_types,
  max_file_bytes,
  primary_file_count,
  expected_width,
  expected_height,
  min_page_count,
  max_page_count,
  supporting_text_min_words,
  supporting_text_max_words,
  rubric_version,
  is_current
)
values
  ('M01_P01', 1, 'phase01-source-2026-07-27', 'SINGLE_BOARD', array['application/pdf', 'image/png']::text[], 41943040, 1, 1920, 1080, 1, 1, 0, 0, 1, true),
  ('M02_P02', 1, 'phase05-pass1-m02-2026-08-01', 'SINGLE_BOARD', array['application/pdf', 'image/png']::text[], 41943040, 1, 1920, 1080, 1, 1, 120, 180, 1, true),
  ('M03_P03', 1, 'phase05-pass3a-m03-2026-08-02', 'SINGLE_BOARD', array['application/pdf', 'image/png']::text[], 41943040, 1, 1920, 1080, 1, 1, 0, 0, 1, true),
  ('M04_P04', 1, 'phase05-pass3b-m04-2026-08-02', 'SINGLE_BOARD', array['application/pdf', 'image/png']::text[], 41943040, 1, 1920, 1080, 1, 1, 0, 0, 1, true),
  ('M05_P05', 1, 'phase05-pass3c-m05-2026-08-02', 'SINGLE_BOARD', array['application/pdf', 'image/png']::text[], 41943040, 1, 1920, 1080, 1, 1, 0, 0, 1, true),
  ('M06_P06', 1, 'phase05-pass3d-m06-2026-08-02', 'SINGLE_BOARD', array['application/pdf', 'image/png']::text[], 41943040, 1, 1920, 1080, 1, 1, 0, 0, 1, true),
  ('M07_P07', 1, 'phase05-pass3e-m07-2026-08-02', 'SINGLE_BOARD', array['application/pdf', 'image/png']::text[], 41943040, 1, 1920, 1080, 1, 1, 0, 0, 1, true),
  ('M08_P08', 1, 'phase05-pass3f-m08-2026-08-02', 'MULTI_PAGE_PACK', array['application/pdf']::text[], 41943040, 1, 1920, 1080, 8, 10, 0, 0, 1, true);

insert into private.project_rubric_criteria (
  project_code,
  rubric_version,
  criterion_number,
  title,
  description,
  max_points
)
values
  ('M01_P01', 1, 1, 'Чтение пространства и диагноз', 'Пятислойное чтение, движение, точка конфликта, масштаб и иерархия приводят к одному точному диагнозу.', 25),
  ('M01_P01', 1, 2, 'Проектное задание, пользователь, программа и связи', 'Пользователь конкретен, сценарий из 5 действий понятен, программа записана глаголами, связи поддерживают диагноз.', 15),
  ('M01_P01', 1, 3, 'Графические доказательства и сравнение', 'План и разрез до и после сопоставимы. Фасад или фронтальный вид добавляет другое доказательство. Подписи и геометрия согласованы.', 25),
  ('M01_P01', 1, 4, 'Концепция, итерации и итоговые решения', 'Концепция отвечает на диагноз. Три итерации показывают развитие. Ровно три решения имеют ожидаемые эффекты. Компромисс конкретен.', 25),
  ('M01_P01', 1, 5, 'Иерархия планшета и графическая дисциплина', 'Планшет имеет ясный порядок чтения, одно доминирующее доказательство, читаемые подписи и черно-бело-серую систему ARCH.START.', 10),
  ('M02_P02', 1, 1, 'Выбор прецедента, тезис и источники', 'Выбран один конкретный реальный объект. Классификация и тезис точны. Источники надежны и указаны.', 15),
  ('M02_P02', 1, 2, 'Визуальные признаки и главное графическое доказательство', 'План, разрез или крупный аннотированный чертеж точны, читаемы и показывают архитектурную логику, а не только внешний вид.', 25),
  ('M02_P02', 1, 3, 'Материал, конструкция и исторические условия', 'Материал, несущая логика и путь нагрузки связаны с формой. Исторические условия объясняются через конкретные признаки.', 25),
  ('M02_P02', 1, 4, 'Пространственный опыт, сравнение и проектный урок', 'Опыт человека подтвержден планом, разрезом, светом, движением или масштабом. Сравнение логично. Урок и компромисс конкретны.', 20),
  ('M02_P02', 1, 5, 'Отдельный текст, иерархия планшета и графическая дисциплина', 'Текст объемом 120–180 слов развивает аргумент. Планшет имеет ясный порядок чтения, один доминирующий чертеж и систему ARCH.START.', 15),
  ('M03_P03', 1, 1, 'Анализ участка и климатический диагноз', 'Граница проекта, пользователь, север, доступ, шум или помеха, вид, солнце, ветер, уклон и сток собраны в один точный диагноз.', 20),
  ('M03_P03', 1, 2, 'Главное интегрированное доказательство', 'Крупный разрез или гибрид плана и разреза связывает пользователя, солнце, воздух, оболочку, воду и наружный комфорт. Геометрия и стрелки технически последовательны.', 25),
  ('M03_P03', 1, 3, 'Дневной свет, воздух и тепловой комфорт', 'Разрез света объясняет блики и затенение. План и разрез воздуха показывают приток, путь и выпуск. Тепловая схема показывает поверхности, изоляцию, перегрев и зону комфорта.', 25),
  ('M03_P03', 1, 4, 'Вода, микроклимат, решения и компромисс', 'Сток отведен от порога, наружная зона имеет работающую микроклиматическую логику. Ровно три решения имеют эффекты. Один компромисс конкретен.', 20),
  ('M03_P03', 1, 5, 'Иерархия планшета и графическая дисциплина', 'Планшет имеет ясный порядок чтения, одно доминирующее доказательство, читаемые подписи и систему ARCH.START из белого, черного и контролируемых серых тонов.', 10),
  ('M04_P04', 1, 1, 'Разнесённая аксонометрия и конструктивная анатомия', 'Слои выровнены и читаются сверху вниз. Разрез правильно различает крышу, балки, пол, стены, колонны, фундаменты, грунт и вторичную оболочку.', 25),
  ('M04_P04', 1, 2, 'Путь нагрузки, опоры и фундаменты', 'Нагрузки от крыши и пола непрерывно доходят через балки, ферму, колонны или стены к фундаментам и грунту. Сетка показывает совмещение основных опор.', 25),
  ('M04_P04', 1, 3, 'Выбор системы, слабое место и устойчивость', 'Система соответствует пролёту и открытости. Одно реальное слабое место отмечено, видимое исправление восстанавливает логику. Боковая устойчивость объяснена на начальном уровне.', 25),
  ('M04_P04', 1, 4, 'Строительная последовательность и итоговые решения', 'Семь этапов расположены логично. Ровно три решения имеют конкретные эффекты. Один компромисс связан с открытостью, глубиной, материалом, сложностью или стоимостью.', 15),
  ('M04_P04', 1, 5, 'Иерархия планшета и графическая дисциплина', 'Планшет имеет ясный порядок чтения, одно доминирующее доказательство, читаемые подписи и систему ARCH.START из белого, чёрного и контролируемых серых тонов.', 10),
  ('M05_P05', 1, 1, 'Материальные роли и сравнение', 'Материалы размещены по условиям и функциям. Сравнение показывает сильные стороны, риски, обслуживание и пригодность, а не только внешний вид.', 20),
  ('M05_P05', 1, 2, 'Послойный разрез оболочки', 'Главный разрез ясно показывает наружную среду, внутренний комфорт, слои, пути воды и тепла, линию контроля воздуха и один точный риск.', 30),
  ('M05_P05', 1, 3, 'Критический узел и контроль риска', 'FAILURE и FIX используют один и тот же узел. Причина отказа видима, а исправление создаёт путь, резервную защиту, непрерывность слоёв и доступ для обслуживания.', 25),
  ('M05_P05', 1, 4, 'Старение, обслуживание и итоговые решения', 'Шкала времени показывает осмотр, ремонт, замену и переиспользование. Три решения имеют эффекты, компромисс конкретен.', 15),
  ('M05_P05', 1, 5, 'Иерархия и визуальная дисциплина', 'Главный разрез доминирует, подписи читаются, линия и серые тона последовательны, планшет не выглядит как moodboard или каталог продукции.', 10),
  ('M06_P06', 1, 1, 'Диагноз устойчивости и связь утверждений с доказательствами', 'Проблемы энергии, воды, материалов, здоровья, ресурсов и участка сформулированы точно. Каждая стратегия отвечает на причину, а слабые экологические утверждения заменены проверяемыми доказательствами.', 20),
  ('M06_P06', 1, 2, 'Разрез пассивной стратегии, энергия и IEQ', 'Доминирующий разрез показывает архитектуру, пользователя, солнце, затенение, дневной свет, блик, связанный путь воздуха, оболочку, теплоприток, теплопотери и сезонный компромисс.', 25),
  ('M06_P06', 1, 3, 'Вода, экология участка и наружный комфорт', 'Карта показывает полный путь стока, приём воды, инфильтрацию или дождевой сад, перелив, твёрдые и прохладные поверхности, тень, посадки, среду обитания, пользователя и обслуживание.', 20),
  ('M06_P06', 1, 4, 'Учебная таблица, углерод, решения и компромисс', 'Все шесть категорий заполнены через обязательное условие, стратегию, баллы, доказательство и компромисс. Шкала различает воплощённый и эксплуатационный углерод. Ровно три решения имеют эффекты и связаны с доказательствами.', 25),
  ('M06_P06', 1, 5, 'Иерархия, визуальная дисциплина и сертификационная граница', 'Главный разрез доминирует, подписи читаются, чёрно-бело-серая система последовательна. На планшете есть обязательная граница, нет официального логотипа, знака или ложного заявления о сертификации.', 10),
  ('M07_P07', 1, 1, 'Главное воздействие и диагноз риска', 'Фрагмент ограничен. Обычный день и стрессовая ситуация сопоставимы. Воздействие, подверженность, уязвимость, риск, слабое место и критическая функция образуют одну точную цепочку.', 20),
  ('M07_P07', 1, 2, 'Главное доказательство до и после', 'Доминирующий план, разрез или гибрид сохраняет одну рамку. На нём видны путь воздействия, пользователи, слабое место и архитектурные изменения до и после.', 30),
  ('M07_P07', 1, 3, 'Апгрейд, резервирование и восстановление', 'Ровно три решения имеют эффекты и доказательства. Резервный путь понятен. Восстановление связано с выбранным воздействием и архитектурой.', 20),
  ('M07_P07', 1, 4, 'Вторичные проверки и компромисс', 'Ровно три компактные проверки остаются второстепенными. Итоговый компромисс называет пользу и дополнительное требование или потерю.', 15),
  ('M07_P07', 1, 5, 'Иерархия, визуальная безопасность и границы', 'Один рисунок доминирует, подписи читаются, линии и серые тона последовательны. Нет катастрофического зрелища или профессиональных гарантий. Граница проекта указана.', 15),
  ('M08_P08', 1, 1, 'Логика проекта и масштаб', 'Один улучшенный проект имеет ясный brief, пользователя, вопрос, концепцию, ограниченный масштаб и профессиональную границу.', 20),
  ('M08_P08', 1, 2, 'Архитектурные доказательства и финальный планшет', 'План, разрез, контекст, конструкция, климат, материал, узел и стратегия устойчивости или жизнестойкости образуют согласованную систему. Главный чертёж доминирует. Каждое важное утверждение связано с доказательством.', 30),
  ('M08_P08', 1, 3, 'Отбор, последовательность и способы представления', 'Drawing Set Selection Map удаляет повторы и выявляет пробелы. Портфолио показывает процесс, итог и рефлексию. Representation Choice Matrix объясняет выбор и ограничения способов представления.', 20),
  ('M08_P08', 1, 4, 'Защита, самооценка и компромисс решения', 'Двухминутная защита указывает на три доказательства, отвечает на вероятные вопросы, называет решения и конкретный компромисс. Самооценка определяет сильную и слабую стороны, приоритет и следующий шаг.', 20),
  ('M08_P08', 1, 5, 'Визуальная дисциплина, язык и сдача', 'Все страницы имеют единый формат 1920 x 1080 px, ясную иерархию, естественный русский текст, компактные подписи, корректные термины и согласованную чёрно-бело-серую систему.', 10);

-- ---------------------------------------------------------------------------
-- Protected reviewer/admin authority
-- ---------------------------------------------------------------------------

create table private.project_staff_roles (
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  staff_role text not null,
  active boolean not null default true,
  granted_by uuid not null
    references auth.users(id)
    on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, staff_role),
  constraint project_staff_role_value
    check (staff_role in ('reviewer', 'admin')),
  constraint project_staff_role_active_state
    check (
      (active and revoked_at is null)
      or (not active and revoked_at is not null)
    )
);

create index project_staff_roles_granted_by_idx
on private.project_staff_roles (
  granted_by,
  granted_at desc
);

-- ---------------------------------------------------------------------------
-- Learner-owned public records
-- ---------------------------------------------------------------------------

create table public.project_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users(id)
    on delete restrict,
  project_code text not null
    references private.course_projects(project_code)
    on update cascade
    on delete restrict,
  current_version_id uuid,
  current_status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  accepted_at timestamptz,
  unique (user_id, project_code),
  constraint project_submission_status_value
    check (
      current_status in (
        'draft',
        'submitted',
        'under_review',
        'revisions_required',
        'resubmitted',
        'accepted',
        'not_accepted'
      )
    ),
  constraint project_submission_timestamp_state
    check (
      (
        current_status = 'draft'
        and submitted_at is null
        and accepted_at is null
      )
      or (
        current_status in (
          'submitted',
          'under_review',
          'revisions_required',
          'resubmitted',
          'not_accepted'
        )
        and submitted_at is not null
        and accepted_at is null
      )
      or (
        current_status = 'accepted'
        and submitted_at is not null
        and accepted_at is not null
      )
    )
);

create index project_submissions_user_status_idx
on public.project_submissions (
  user_id,
  current_status,
  updated_at desc
);

create index project_submissions_project_status_idx
on public.project_submissions (
  project_code,
  current_status,
  updated_at desc
);

create table public.project_submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null
    references public.project_submissions(id)
    on delete cascade,
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  project_code text not null
    references private.course_projects(project_code)
    on update cascade
    on delete restrict,
  version_number smallint not null,
  version_state text not null default 'draft',
  learner_note text,
  supporting_text text,
  project_content_version text not null,
  policy_version smallint not null,
  rubric_version smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  locked_at timestamptz,
  unique (submission_id, version_number),
  unique (submission_id, id),
  foreign key (project_code, policy_version)
    references private.project_submission_policies(
      project_code,
      policy_version
    )
    on update cascade
    on delete restrict,
  constraint project_submission_version_number
    check (version_number > 0),
  constraint project_submission_version_state
    check (version_state in ('draft', 'submitted')),
  constraint project_submission_version_note_length
    check (
      learner_note is null
      or char_length(learner_note) <= 2000
    ),
  constraint project_submission_supporting_text_length
    check (
      supporting_text is null
      or char_length(supporting_text) <= 8000
    ),
  constraint project_submission_version_content_version
    check (char_length(project_content_version) between 1 and 120),
  constraint project_submission_version_timestamp_state
    check (
      (
        version_state = 'draft'
        and submitted_at is null
        and locked_at is null
      )
      or (
        version_state = 'submitted'
        and submitted_at is not null
        and locked_at is not null
      )
    )
);

create unique index project_submission_one_draft_idx
on public.project_submission_versions (submission_id)
where version_state = 'draft';

create index project_submission_versions_user_recent_idx
on public.project_submission_versions (
  user_id,
  updated_at desc
);

create index project_submission_versions_policy_idx
on public.project_submission_versions (
  project_code,
  policy_version
);

alter table public.project_submissions
add constraint project_submissions_current_version_fk
foreign key (id, current_version_id)
references public.project_submission_versions(
  submission_id,
  id
)
deferrable initially deferred;

create table public.project_submission_files (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null unique
    references public.project_submission_versions(id)
    on delete cascade,
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  file_role text not null default 'primary',
  bucket_id text not null,
  object_path text not null,
  original_filename text not null,
  declared_mime text not null,
  detected_mime text,
  size_bytes bigint not null,
  sha256 text not null,
  validation_status text not null default 'pending',
  scan_status text not null default 'pending',
  page_count smallint,
  pixel_width integer,
  pixel_height integer,
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path),
  constraint project_submission_file_role
    check (file_role = 'primary'),
  constraint project_submission_file_bucket
    check (bucket_id = 'project-submissions'),
  constraint project_submission_file_original_name
    check (
      char_length(original_filename) between 1 and 255
      and pg_catalog.strpos(original_filename, '/') = 0
      and pg_catalog.strpos(
        original_filename,
        pg_catalog.chr(92)
      ) = 0
      and (
        (
          declared_mime = 'application/pdf'
          and pg_catalog.lower(original_filename) ~ '\.pdf$'
        )
        or (
          declared_mime = 'image/png'
          and pg_catalog.lower(original_filename) ~ '\.png$'
        )
      )
    ),
  constraint project_submission_file_declared_mime
    check (declared_mime in ('application/pdf', 'image/png')),
  constraint project_submission_file_detected_mime
    check (
      detected_mime is null
      or detected_mime in ('application/pdf', 'image/png')
    ),
  constraint project_submission_file_size
    check (size_bytes between 1 and 41943040),
  constraint project_submission_file_sha256
    check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint project_submission_file_validation_status
    check (validation_status in ('pending', 'valid', 'rejected')),
  constraint project_submission_file_scan_status
    check (scan_status in ('pending', 'passed', 'failed', 'not_required')),
  constraint project_submission_file_dimensions
    check (
      (page_count is null or page_count > 0)
      and (pixel_width is null or pixel_width > 0)
      and (pixel_height is null or pixel_height > 0)
    ),
  constraint project_submission_file_valid_shape
    check (
      validation_status <> 'valid'
      or (
        detected_mime is not null
        and detected_mime = declared_mime
        and scan_status in ('passed', 'not_required')
        and (
          (
            detected_mime = 'application/pdf'
            and page_count is not null
            and pixel_width is null
            and pixel_height is null
          )
          or (
            detected_mime = 'image/png'
            and page_count is null
            and pixel_width = 1920
            and pixel_height = 1080
          )
        )
      )
    )
);

create index project_submission_files_user_recent_idx
on public.project_submission_files (
  user_id,
  created_at desc
);

create table public.project_reviews (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null unique
    references public.project_submission_versions(id)
    on delete restrict,
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  reviewer_id uuid not null
    references auth.users(id)
    on delete restrict,
  decision text not null,
  summary text not null,
  score smallint not null,
  rubric_version smallint not null,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint project_review_decision
    check (
      decision in (
        'revisions_required',
        'accepted',
        'not_accepted'
      )
    ),
  constraint project_review_summary_length
    check (char_length(summary) between 1 and 5000),
  constraint project_review_score
    check (score between 0 and 100),
  constraint project_review_rubric_version
    check (rubric_version > 0),
  constraint project_review_no_self_review
    check (reviewer_id <> user_id)
);

create index project_reviews_user_recent_idx
on public.project_reviews (
  user_id,
  reviewed_at desc
);

create index project_reviews_reviewer_recent_idx
on public.project_reviews (
  reviewer_id,
  reviewed_at desc
);

create table public.project_review_criteria (
  review_id uuid not null
    references public.project_reviews(id)
    on delete restrict,
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  criterion_number smallint not null,
  criterion_title_snapshot text not null,
  criterion_description_snapshot text not null,
  max_points smallint not null,
  awarded_points smallint not null,
  comment text,
  created_at timestamptz not null default now(),
  primary key (review_id, criterion_number),
  constraint project_review_criterion_number
    check (criterion_number between 1 and 5),
  constraint project_review_criterion_title
    check (char_length(criterion_title_snapshot) between 1 and 300),
  constraint project_review_criterion_description
    check (char_length(criterion_description_snapshot) between 1 and 2000),
  constraint project_review_criterion_points
    check (
      max_points between 1 and 100
      and awarded_points between 0 and max_points
    ),
  constraint project_review_criterion_comment
    check (comment is null or char_length(comment) <= 2000)
);

create index project_review_criteria_user_recent_idx
on public.project_review_criteria (
  user_id,
  created_at desc
);

create table public.project_status_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null
    references public.project_submissions(id)
    on delete cascade,
  version_id uuid
    references public.project_submission_versions(id)
    on delete set null,
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  actor_id uuid
    references auth.users(id)
    on delete set null,
  actor_role text not null,
  event_type text not null,
  from_status text,
  to_status text,
  public_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint project_status_event_actor_role
    check (actor_role in ('learner', 'reviewer', 'admin', 'system')),
  constraint project_status_event_type
    check (
      event_type in (
        'draft_created',
        'draft_updated',
        'submitted',
        'reviewer_assigned',
        'review_started',
        'revisions_required',
        'resubmitted',
        'accepted',
        'not_accepted',
        'draft_deleted',
        'assignment_released'
      )
    ),
  constraint project_status_event_from_status
    check (
      from_status is null
      or from_status in (
        'draft',
        'submitted',
        'under_review',
        'revisions_required',
        'resubmitted',
        'accepted',
        'not_accepted'
      )
    ),
  constraint project_status_event_to_status
    check (
      to_status is null
      or to_status in (
        'draft',
        'submitted',
        'under_review',
        'revisions_required',
        'resubmitted',
        'accepted',
        'not_accepted'
      )
    ),
  constraint project_status_event_payload_object
    check (
      pg_catalog.jsonb_typeof(public_payload) = 'object'
      and char_length(public_payload::text) <= 4000
    )
);

create index project_status_events_user_recent_idx
on public.project_status_events (
  user_id,
  created_at desc
);

create index project_status_events_submission_recent_idx
on public.project_status_events (
  submission_id,
  created_at desc
);

create index project_status_events_version_idx
on public.project_status_events (version_id);

create index project_status_events_actor_recent_idx
on public.project_status_events (
  actor_id,
  created_at desc
);

create table private.project_reviewer_assignments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null
    references public.project_submissions(id)
    on delete cascade,
  reviewer_id uuid not null
    references auth.users(id)
    on delete restrict,
  assigned_by uuid not null
    references auth.users(id)
    on delete restrict,
  assigned_at timestamptz not null default now(),
  released_at timestamptz
);

create unique index project_reviewer_one_active_assignment_idx
on private.project_reviewer_assignments (submission_id)
where released_at is null;

create index project_reviewer_assignments_reviewer_idx
on private.project_reviewer_assignments (
  reviewer_id,
  released_at,
  assigned_at desc
);

create index project_reviewer_assignments_submission_idx
on private.project_reviewer_assignments (submission_id);

create index project_reviewer_assignments_assigned_by_idx
on private.project_reviewer_assignments (
  assigned_by,
  assigned_at desc
);

-- ---------------------------------------------------------------------------
-- Foundation helpers and database-owned invariants
-- ---------------------------------------------------------------------------

create or replace function private.project_submission_transition_is_allowed(
  p_from_status text,
  p_to_status text
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when p_from_status = 'draft'
      then p_to_status = 'submitted'
    when p_from_status in ('submitted', 'resubmitted')
      then p_to_status = 'under_review'
    when p_from_status = 'under_review'
      then p_to_status in (
        'revisions_required',
        'accepted',
        'not_accepted'
      )
    when p_from_status in ('revisions_required', 'not_accepted')
      then p_to_status = 'resubmitted'
    else false
  end;
$$;

create or replace function private.project_staff_has_role(
  p_user_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.project_staff_roles as staff
    where staff.user_id = p_user_id
      and staff.active
      and staff.staff_role = any (p_roles)
  );
$$;

create or replace function private.project_supporting_text_word_count(
  p_text text
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when nullif(pg_catalog.btrim(coalesce(p_text, '')), '') is null
      then 0
    else cardinality(
      pg_catalog.regexp_split_to_array(
        pg_catalog.btrim(p_text),
        '[[:space:]]+'
      )
    )
  end;
$$;

create or replace function private.project_version_meets_submission_policy(
  p_version_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_submission_versions as version
    join private.project_submission_policies as policy
      on policy.project_code = version.project_code
      and policy.policy_version = version.policy_version
    join private.course_projects as project
      on project.project_code = version.project_code
    join private.course_modules as module
      on module.module_code = project.module_code
    join public.project_submission_files as file
      on file.version_id = version.id
    where version.id = p_version_id
      and file.validation_status = 'valid'
      and file.detected_mime = any (policy.allowed_mime_types)
      and file.size_bytes between 1 and policy.max_file_bytes
      and (
        (
          file.detected_mime = 'application/pdf'
          and file.page_count between
            policy.min_page_count and policy.max_page_count
        )
        or (
          file.detected_mime = 'image/png'
          and policy.format_type = 'SINGLE_BOARD'
          and file.pixel_width = policy.expected_width
          and file.pixel_height = policy.expected_height
        )
      )
      and private.project_supporting_text_word_count(
        version.supporting_text
      ) between
        policy.supporting_text_min_words
        and policy.supporting_text_max_words
      and (
        select count(*)
        from public.lesson_completions as completion
        join private.course_lessons as lesson
          on lesson.lesson_code = completion.lesson_code
        where completion.user_id = version.user_id
          and lesson.module_code = project.module_code
      ) = module.lesson_count
  );
$$;

create or replace function private.project_review_is_complete(
  p_version_id uuid,
  p_decision text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_reviews as review
    join public.project_review_criteria as criterion
      on criterion.review_id = review.id
    where review.version_id = p_version_id
      and review.decision = p_decision
    group by review.id, review.score
    having count(*) = 5
      and sum(criterion.awarded_points) = review.score
      and sum(criterion.max_points) = 100
  );
$$;

create or replace function private.stamp_project_staff_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(
    pg_catalog.current_setting(
      'archstart.project_staff_write_authorized',
      true
    ),
    ''
  ) <> 'on'
  then
    raise exception using
      errcode = '42501',
      message = 'project staff writes require an authorized server workflow';
  end if;

  if tg_op = 'INSERT' then
    new.granted_at := now();
    if new.active then
      new.revoked_at := null;
    else
      new.revoked_at := coalesce(new.revoked_at, now());
    end if;
  else
    new.user_id := old.user_id;
    new.staff_role := old.staff_role;
    new.granted_by := old.granted_by;
    if new.active then
      if not old.active then
        new.granted_at := now();
      else
        new.granted_at := old.granted_at;
      end if;
      new.revoked_at := null;
    else
      new.granted_at := old.granted_at;
      new.revoked_at := coalesce(new.revoked_at, now());
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.stamp_project_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_version_state text;
  active_assignment_exists boolean;
begin
  if coalesce(
    pg_catalog.current_setting(
      'archstart.project_submission_write_authorized',
      true
    ),
    ''
  ) <> 'on'
  then
    raise exception using
      errcode = '42501',
      message = 'project submission writes require an authorized server workflow';
  end if;

  if tg_op = 'INSERT' then
    if current_user_id is not null then
      new.user_id := current_user_id;
    elsif new.user_id is null then
      raise exception using
        errcode = '23502',
        message = 'project submission user_id is required';
    end if;

    new.id := coalesce(new.id, gen_random_uuid());
    new.current_version_id := null;
    new.current_status := 'draft';
    new.created_at := now();
    new.updated_at := now();
    new.submitted_at := null;
    new.accepted_at := null;
    return new;
  end if;

  new.id := old.id;
  new.user_id := old.user_id;
  new.project_code := old.project_code;
  new.created_at := old.created_at;
  new.updated_at := now();

  if new.current_version_id is distinct from old.current_version_id then
    if coalesce(
      pg_catalog.current_setting(
        'archstart.project_current_version_write_authorized',
        true
      ),
      ''
    ) <> 'on'
    then
      raise exception using
        errcode = '42501',
        message = 'project current-version changes require an authorized server workflow';
    end if;

    if old.current_status not in (
      'draft',
      'revisions_required',
      'not_accepted'
    ) then
      raise exception using
        errcode = '23514',
        message = 'current version may change only for a draft or resubmission';
    end if;
  end if;

  if new.current_status is distinct from old.current_status then
    if coalesce(
      pg_catalog.current_setting(
        'archstart.project_transition_authorized',
        true
      ),
      ''
    ) <> 'on'
    then
      raise exception using
        errcode = '42501',
        message = 'project status transitions require an authorized server workflow';
    end if;

    if not private.project_submission_transition_is_allowed(
      old.current_status,
      new.current_status
    ) then
      raise exception using
        errcode = '23514',
        message = 'invalid project submission status transition';
    end if;

    if new.current_version_id is null then
      raise exception using
        errcode = '23514',
        message = 'project status transition requires a current version';
    end if;

    select version_state
    into current_version_state
    from public.project_submission_versions
    where id = new.current_version_id
      and submission_id = new.id;

    if current_version_state <> 'submitted' then
      raise exception using
        errcode = '23514',
        message = 'project status transition requires a submitted current version';
    end if;

    if new.current_status = 'submitted' then
      new.submitted_at := coalesce(old.submitted_at, now());
      new.accepted_at := null;
    elsif new.current_status = 'under_review' then
      select exists (
        select 1
        from private.project_reviewer_assignments as assignment
        where assignment.submission_id = new.id
          and assignment.released_at is null
      )
      into active_assignment_exists;

      if active_assignment_exists is not true then
        raise exception using
          errcode = '23514',
          message = 'under_review requires an active reviewer assignment';
      end if;

      new.submitted_at := old.submitted_at;
      new.accepted_at := null;
    elsif new.current_status in (
      'revisions_required',
      'accepted',
      'not_accepted'
    ) then
      if not private.project_review_is_complete(
        new.current_version_id,
        new.current_status
      ) then
        raise exception using
          errcode = '23514',
          message = 'project decision requires one complete five-criterion review';
      end if;

      new.submitted_at := old.submitted_at;
      if new.current_status = 'accepted' then
        new.accepted_at := now();
      else
        new.accepted_at := null;
      end if;
    elsif new.current_status = 'resubmitted' then
      if new.current_version_id is not distinct from old.current_version_id then
        raise exception using
          errcode = '23514',
          message = 'resubmission requires a new current version';
      end if;
      new.submitted_at := old.submitted_at;
      new.accepted_at := null;
    end if;
  else
    new.submitted_at := old.submitted_at;
    new.accepted_at := old.accepted_at;
  end if;

  return new;
end;
$$;

create or replace function private.guard_project_submission_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(
    pg_catalog.current_setting(
      'archstart.project_submission_write_authorized',
      true
    ),
    ''
  ) <> 'on'
    or old.current_status <> 'draft'
  then
    raise exception using
      errcode = '42501',
      message = 'only an authorized server workflow may delete a draft submission';
  end if;

  return old;
end;
$$;

create or replace function private.stamp_project_submission_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  owner_project_code text;
  owner_submission_status text;
  policy_row private.project_submission_policies%rowtype;
begin
  if coalesce(
    pg_catalog.current_setting(
      'archstart.project_version_write_authorized',
      true
    ),
    ''
  ) <> 'on'
  then
    raise exception using
      errcode = '42501',
      message = 'project version writes require an authorized server workflow';
  end if;

  select
    submission.user_id,
    submission.project_code,
    submission.current_status
  into
    owner_id,
    owner_project_code,
    owner_submission_status
  from public.project_submissions as submission
  where submission.id = new.submission_id;

  if owner_id is null then
    raise exception using
      errcode = '23503',
      message = 'project submission does not exist';
  end if;

  if tg_op = 'INSERT' then
    if owner_submission_status not in (
      'draft',
      'revisions_required',
      'not_accepted'
    ) then
      raise exception using
        errcode = '23514',
        message = 'new project versions require a draft or revision state';
    end if;

    select *
    into policy_row
    from private.project_submission_policies as policy
    where policy.project_code = owner_project_code
      and policy.is_current;

    if policy_row.project_code is null then
      raise exception using
        errcode = '55000',
        message = 'current project submission policy is missing';
    end if;

    new.id := coalesce(new.id, gen_random_uuid());
    new.user_id := owner_id;
    new.project_code := owner_project_code;

    select coalesce(max(version_number), 0) + 1
    into new.version_number
    from public.project_submission_versions
    where submission_id = new.submission_id;

    new.version_state := 'draft';
    new.project_content_version := policy_row.content_version;
    new.policy_version := policy_row.policy_version;
    new.rubric_version := policy_row.rubric_version;
    new.created_at := now();
    new.updated_at := now();
    new.submitted_at := null;
    new.locked_at := null;
    return new;
  end if;

  if old.version_state = 'submitted' then
    raise exception using
      errcode = '55000',
      message = 'submitted project versions are immutable';
  end if;

  new.id := old.id;
  new.submission_id := old.submission_id;
  new.user_id := old.user_id;
  new.project_code := old.project_code;
  new.version_number := old.version_number;
  new.project_content_version := old.project_content_version;
  new.policy_version := old.policy_version;
  new.rubric_version := old.rubric_version;
  new.created_at := old.created_at;
  new.updated_at := now();

  if new.version_state = 'submitted' then
    if coalesce(
      pg_catalog.current_setting(
        'archstart.project_version_submit_authorized',
        true
      ),
      ''
    ) <> 'on'
    then
      raise exception using
        errcode = '42501',
        message = 'project version submission requires an authorized server workflow';
    end if;

    if not private.project_version_meets_submission_policy(old.id) then
      raise exception using
        errcode = '23514',
        message = 'project version does not satisfy the active submission policy';
    end if;

    new.submitted_at := now();
    new.locked_at := now();
  else
    new.submitted_at := null;
    new.locked_at := null;
  end if;

  return new;
end;
$$;

create or replace function private.guard_project_version_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(
    pg_catalog.current_setting(
      'archstart.project_version_write_authorized',
      true
    ),
    ''
  ) <> 'on'
    or old.version_state <> 'draft'
  then
    raise exception using
      errcode = '42501',
      message = 'only an authorized server workflow may delete a draft version';
  end if;

  return old;
end;
$$;

create or replace function private.stamp_project_submission_file()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  parent_submission_id uuid;
  parent_version_state text;
  extension text;
begin
  if coalesce(
    pg_catalog.current_setting(
      'archstart.project_file_write_authorized',
      true
    ),
    ''
  ) <> 'on'
  then
    raise exception using
      errcode = '42501',
      message = 'project file metadata writes require an authorized server workflow';
  end if;

  select version.user_id, version.submission_id, version.version_state
  into owner_id, parent_submission_id, parent_version_state
  from public.project_submission_versions as version
  where version.id = new.version_id;

  if owner_id is null then
    raise exception using
      errcode = '23503',
      message = 'project version does not exist';
  end if;

  if parent_version_state <> 'draft' then
    raise exception using
      errcode = '55000',
      message = 'project files are mutable only while the version is a draft';
  end if;

  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, gen_random_uuid());
    new.user_id := owner_id;
    new.file_role := 'primary';
    new.bucket_id := 'project-submissions';
    extension := case
      when new.declared_mime = 'application/pdf' then 'pdf'
      when new.declared_mime = 'image/png' then 'png'
      else null
    end;

    if extension is null then
      raise exception using
        errcode = '23514',
        message = 'unsupported project file MIME type';
    end if;

    new.object_path :=
      owner_id::text || '/' ||
      parent_submission_id::text || '/' ||
      new.version_id::text || '/' ||
      new.id::text || '.' || extension;
    new.sha256 := pg_catalog.lower(new.sha256);
    new.created_at := now();
    return new;
  end if;

  new.id := old.id;
  new.version_id := old.version_id;
  new.user_id := old.user_id;
  new.file_role := old.file_role;
  new.bucket_id := old.bucket_id;
  new.object_path := old.object_path;
  new.original_filename := old.original_filename;
  new.declared_mime := old.declared_mime;
  new.size_bytes := old.size_bytes;
  new.sha256 := old.sha256;
  new.created_at := old.created_at;
  return new;
end;
$$;

create or replace function private.guard_project_file_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_version_state text;
begin
  if coalesce(
    pg_catalog.current_setting(
      'archstart.project_file_write_authorized',
      true
    ),
    ''
  ) <> 'on'
  then
    raise exception using
      errcode = '42501',
      message = 'project file deletion requires an authorized server workflow';
  end if;

  select version_state
  into parent_version_state
  from public.project_submission_versions
  where id = old.version_id;

  if parent_version_state <> 'draft' then
    raise exception using
      errcode = '55000',
      message = 'submitted project file metadata is immutable';
  end if;

  return old;
end;
$$;

create or replace function private.stamp_project_reviewer_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  submission_status text;
begin
  if coalesce(
    pg_catalog.current_setting(
      'archstart.project_assignment_write_authorized',
      true
    ),
    ''
  ) <> 'on'
  then
    raise exception using
      errcode = '42501',
      message = 'reviewer assignment writes require an authorized server workflow';
  end if;

  select user_id, current_status
  into owner_id, submission_status
  from public.project_submissions
  where id = new.submission_id;

  if owner_id is null then
    raise exception using
      errcode = '23503',
      message = 'project submission does not exist';
  end if;

  if tg_op = 'INSERT' then
    if submission_status not in (
      'submitted',
      'resubmitted',
      'under_review'
    ) then
      raise exception using
        errcode = '23514',
        message = 'reviewer assignment requires a submitted project';
    end if;

    if new.reviewer_id = owner_id then
      raise exception using
        errcode = '23514',
        message = 'reviewers cannot review their own project submission';
    end if;

    if not private.project_staff_has_role(
      new.reviewer_id,
      array['reviewer', 'admin']::text[]
    ) then
      raise exception using
        errcode = '42501',
        message = 'assigned reviewer lacks an active reviewer role';
    end if;

    if not private.project_staff_has_role(
      new.assigned_by,
      array['admin']::text[]
    ) then
      raise exception using
        errcode = '42501',
        message = 'reviewer assignment requires an active admin';
    end if;

    new.id := coalesce(new.id, gen_random_uuid());
    new.assigned_at := now();
    new.released_at := null;
    return new;
  end if;

  if old.released_at is not null then
    raise exception using
      errcode = '55000',
      message = 'released reviewer assignments are immutable';
  end if;

  new.id := old.id;
  new.submission_id := old.submission_id;
  new.reviewer_id := old.reviewer_id;
  new.assigned_by := old.assigned_by;
  new.assigned_at := old.assigned_at;
  new.released_at := now();
  return new;
end;
$$;

create or replace function private.stamp_project_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  parent_submission_id uuid;
  parent_project_code text;
  parent_rubric_version smallint;
  parent_version_state text;
  parent_submission_status text;
  active_assignment_exists boolean;
begin
  if coalesce(
    pg_catalog.current_setting(
      'archstart.project_review_write_authorized',
      true
    ),
    ''
  ) <> 'on'
  then
    raise exception using
      errcode = '42501',
      message = 'project review writes require an authorized server workflow';
  end if;

  select
    version.user_id,
    version.submission_id,
    version.project_code,
    version.rubric_version,
    version.version_state,
    submission.current_status
  into
    owner_id,
    parent_submission_id,
    parent_project_code,
    parent_rubric_version,
    parent_version_state,
    parent_submission_status
  from public.project_submission_versions as version
  join public.project_submissions as submission
    on submission.id = version.submission_id
  where version.id = new.version_id
    and submission.current_version_id = version.id;

  if owner_id is null then
    raise exception using
      errcode = '23503',
      message = 'current project version does not exist';
  end if;

  if parent_version_state <> 'submitted'
    or parent_submission_status <> 'under_review'
  then
    raise exception using
      errcode = '23514',
      message = 'project review requires the current submitted version under review';
  end if;

  if new.reviewer_id = owner_id then
    raise exception using
      errcode = '23514',
      message = 'reviewers cannot review their own project submission';
  end if;

  if not private.project_staff_has_role(
    new.reviewer_id,
    array['reviewer', 'admin']::text[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'reviewer lacks an active project staff role';
  end if;

  select exists (
    select 1
    from private.project_reviewer_assignments as assignment
    where assignment.submission_id = parent_submission_id
      and assignment.reviewer_id = new.reviewer_id
      and assignment.released_at is null
  )
  into active_assignment_exists;

  if active_assignment_exists is not true then
    raise exception using
      errcode = '42501',
      message = 'reviewer is not assigned to this project submission';
  end if;

  new.id := coalesce(new.id, gen_random_uuid());
  new.user_id := owner_id;
  new.rubric_version := parent_rubric_version;
  new.summary := pg_catalog.btrim(new.summary);
  new.reviewed_at := now();
  new.created_at := now();
  return new;
end;
$$;

create or replace function private.stamp_project_review_criterion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  parent_project_code text;
  parent_rubric_version smallint;
  catalog_title text;
  catalog_description text;
  catalog_max_points smallint;
begin
  if coalesce(
    pg_catalog.current_setting(
      'archstart.project_review_write_authorized',
      true
    ),
    ''
  ) <> 'on'
  then
    raise exception using
      errcode = '42501',
      message = 'project review criterion writes require an authorized server workflow';
  end if;

  select
    review.user_id,
    version.project_code,
    review.rubric_version
  into
    owner_id,
    parent_project_code,
    parent_rubric_version
  from public.project_reviews as review
  join public.project_submission_versions as version
    on version.id = review.version_id
  where review.id = new.review_id;

  if owner_id is null then
    raise exception using
      errcode = '23503',
      message = 'project review does not exist';
  end if;

  select title, description, max_points
  into catalog_title, catalog_description, catalog_max_points
  from private.project_rubric_criteria
  where project_code = parent_project_code
    and rubric_version = parent_rubric_version
    and criterion_number = new.criterion_number;

  if catalog_title is null then
    raise exception using
      errcode = '23503',
      message = 'project rubric criterion does not exist';
  end if;

  new.user_id := owner_id;
  new.criterion_title_snapshot := catalog_title;
  new.criterion_description_snapshot := catalog_description;
  new.max_points := catalog_max_points;
  new.created_at := now();
  return new;
end;
$$;

create or replace function private.stamp_project_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  event_version_matches boolean;
begin
  if coalesce(
    pg_catalog.current_setting(
      'archstart.project_event_write_authorized',
      true
    ),
    ''
  ) <> 'on'
  then
    raise exception using
      errcode = '42501',
      message = 'project status-event writes require an authorized server workflow';
  end if;

  select user_id
  into owner_id
  from public.project_submissions
  where id = new.submission_id;

  if owner_id is null then
    raise exception using
      errcode = '23503',
      message = 'project submission does not exist';
  end if;

  if new.version_id is not null then
    select exists (
      select 1
      from public.project_submission_versions as version
      where version.id = new.version_id
        and version.submission_id = new.submission_id
    )
    into event_version_matches;

    if event_version_matches is not true then
      raise exception using
        errcode = '23514',
        message = 'project status event version does not belong to the submission';
    end if;
  end if;

  if new.actor_role = 'learner'
    and new.actor_id is distinct from owner_id
  then
    raise exception using
      errcode = '42501',
      message = 'learner project event actor mismatch';
  elsif new.actor_role in ('reviewer', 'admin')
    and not private.project_staff_has_role(
      new.actor_id,
      array[new.actor_role]::text[]
    )
  then
    raise exception using
      errcode = '42501',
      message = 'project event actor lacks the required staff role';
  elsif new.actor_role = 'system'
    and new.actor_id is not null
  then
    raise exception using
      errcode = '23514',
      message = 'system project events must not carry a user actor';
  end if;

  new.id := coalesce(new.id, gen_random_uuid());
  new.user_id := owner_id;
  new.created_at := now();
  return new;
end;
$$;

create or replace function private.reject_project_immutable_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'immutable project records cannot be updated or deleted';
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger on_project_staff_role_stamp
before insert or update on private.project_staff_roles
for each row execute function private.stamp_project_staff_role();

create trigger on_project_staff_role_reject_delete
before delete on private.project_staff_roles
for each row execute function private.reject_project_immutable_mutation();

create trigger on_project_submission_stamp
before insert or update on public.project_submissions
for each row execute function private.stamp_project_submission();

create trigger on_project_submission_guard_delete
before delete on public.project_submissions
for each row execute function private.guard_project_submission_delete();

create trigger on_project_submission_version_stamp
before insert or update on public.project_submission_versions
for each row execute function private.stamp_project_submission_version();

create trigger on_project_submission_version_guard_delete
before delete on public.project_submission_versions
for each row execute function private.guard_project_version_delete();

create trigger on_project_submission_file_stamp
before insert or update on public.project_submission_files
for each row execute function private.stamp_project_submission_file();

create trigger on_project_submission_file_guard_delete
before delete on public.project_submission_files
for each row execute function private.guard_project_file_delete();

create trigger on_project_reviewer_assignment_stamp
before insert or update on private.project_reviewer_assignments
for each row execute function private.stamp_project_reviewer_assignment();

create trigger on_project_reviewer_assignment_reject_delete
before delete on private.project_reviewer_assignments
for each row execute function private.reject_project_immutable_mutation();

create trigger on_project_review_stamp
before insert on public.project_reviews
for each row execute function private.stamp_project_review();

create trigger on_project_review_reject_mutation
before update or delete on public.project_reviews
for each row execute function private.reject_project_immutable_mutation();

create trigger on_project_review_criterion_stamp
before insert on public.project_review_criteria
for each row execute function private.stamp_project_review_criterion();

create trigger on_project_review_criterion_reject_mutation
before update or delete on public.project_review_criteria
for each row execute function private.reject_project_immutable_mutation();

create trigger on_project_status_event_stamp
before insert on public.project_status_events
for each row execute function private.stamp_project_status_event();

create trigger on_project_status_event_reject_mutation
before update or delete on public.project_status_events
for each row execute function private.reject_project_immutable_mutation();

-- ---------------------------------------------------------------------------
-- RLS and least-privilege grants
-- ---------------------------------------------------------------------------

alter table public.project_submissions enable row level security;
alter table public.project_submission_versions enable row level security;
alter table public.project_submission_files enable row level security;
alter table public.project_reviews enable row level security;
alter table public.project_review_criteria enable row level security;
alter table public.project_status_events enable row level security;

revoke all on table
  public.project_submissions,
  public.project_submission_versions,
  public.project_submission_files,
  public.project_reviews,
  public.project_review_criteria,
  public.project_status_events
from public, anon, authenticated;

revoke all on table
  private.project_submission_policies,
  private.project_rubric_criteria,
  private.project_staff_roles,
  private.project_reviewer_assignments
from public, anon, authenticated;

-- Learners receive only explicitly safe own-row columns.
grant select (
  id,
  project_code,
  current_version_id,
  current_status,
  created_at,
  updated_at,
  submitted_at,
  accepted_at
)
on public.project_submissions
to authenticated;

grant select (
  id,
  submission_id,
  project_code,
  version_number,
  version_state,
  learner_note,
  supporting_text,
  project_content_version,
  policy_version,
  rubric_version,
  created_at,
  updated_at,
  submitted_at,
  locked_at
)
on public.project_submission_versions
to authenticated;

grant select (
  id,
  version_id,
  file_role,
  original_filename,
  declared_mime,
  detected_mime,
  size_bytes,
  sha256,
  validation_status,
  scan_status,
  page_count,
  pixel_width,
  pixel_height,
  created_at
)
on public.project_submission_files
to authenticated;

grant select (
  id,
  version_id,
  decision,
  summary,
  score,
  rubric_version,
  reviewed_at,
  created_at
)
on public.project_reviews
to authenticated;

grant select (
  review_id,
  criterion_number,
  criterion_title_snapshot,
  criterion_description_snapshot,
  max_points,
  awarded_points,
  comment,
  created_at
)
on public.project_review_criteria
to authenticated;

grant select (
  id,
  submission_id,
  version_id,
  actor_role,
  event_type,
  from_status,
  to_status,
  public_payload,
  created_at
)
on public.project_status_events
to authenticated;

-- Trusted server groundwork; custom GUC guards keep direct writes inert until
-- Pass 2B2 exposes narrow authenticated workflows.
grant select, insert, update, delete on table
  public.project_submissions,
  public.project_submission_versions,
  public.project_submission_files
to service_role;

grant select, insert on table
  public.project_reviews,
  public.project_review_criteria,
  public.project_status_events
to service_role;

grant select on table
  private.project_submission_policies,
  private.project_rubric_criteria
to service_role;

grant select, insert, update on table
  private.project_staff_roles,
  private.project_reviewer_assignments
to service_role;

create policy "project_submissions_select_own"
on public.project_submissions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "project_submission_versions_select_own"
on public.project_submission_versions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "project_submission_files_select_own"
on public.project_submission_files
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "project_reviews_select_own"
on public.project_reviews
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "project_review_criteria_select_own"
on public.project_review_criteria
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "project_status_events_select_own"
on public.project_status_events
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on function
  private.project_submission_transition_is_allowed(text, text),
  private.project_staff_has_role(uuid, text[]),
  private.project_supporting_text_word_count(text),
  private.project_version_meets_submission_policy(uuid),
  private.project_review_is_complete(uuid, text),
  private.stamp_project_staff_role(),
  private.stamp_project_submission(),
  private.guard_project_submission_delete(),
  private.stamp_project_submission_version(),
  private.guard_project_version_delete(),
  private.stamp_project_submission_file(),
  private.guard_project_file_delete(),
  private.stamp_project_reviewer_assignment(),
  private.stamp_project_review(),
  private.stamp_project_review_criterion(),
  private.stamp_project_status_event(),
  private.reject_project_immutable_mutation()
from public, anon, authenticated;

grant execute on function
  private.project_submission_transition_is_allowed(text, text),
  private.project_staff_has_role(uuid, text[]),
  private.project_supporting_text_word_count(text),
  private.project_version_meets_submission_policy(uuid),
  private.project_review_is_complete(uuid, text),
  private.stamp_project_staff_role(),
  private.stamp_project_submission(),
  private.guard_project_submission_delete(),
  private.stamp_project_submission_version(),
  private.guard_project_version_delete(),
  private.stamp_project_submission_file(),
  private.guard_project_file_delete(),
  private.stamp_project_reviewer_assignment(),
  private.stamp_project_review(),
  private.stamp_project_review_criterion(),
  private.stamp_project_status_event(),
  private.reject_project_immutable_mutation()
to service_role;

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

comment on table private.project_submission_policies is
  'Versioned Phase 07 project deliverable policy. One primary PDF/PNG file; M08 is PDF-only 8–10 pages.';

comment on table private.project_rubric_criteria is
  'Exact five-criterion, 100-point project rubrics copied from accepted M01–M08 learner content.';

comment on table private.project_staff_roles is
  'Protected reviewer/admin authority. It is not stored in learner-editable profiles or JWT user metadata.';

comment on table public.project_submissions is
  'One logical learner submission per project code. Workflow mutations remain server-only and inactive until Pass 2B2.';

comment on table public.project_submission_versions is
  'Editable draft followed by immutable submitted versions. Old versions are retained.';

comment on table public.project_submission_files is
  'Private project file metadata only. Pass 2B1 creates no Storage bucket and uploads no bytes.';

comment on table public.project_reviews is
  'One immutable structured review per submitted version; acceptance is a separate reviewer decision, not an automatic score threshold.';

comment on table public.project_status_events is
  'Append-only learner-visible project status history with reviewer identity hidden by column privileges.';

-- ---------------------------------------------------------------------------
-- Postcondition checks
-- ---------------------------------------------------------------------------

do $$
declare
  rls_table_count integer;
  policy_count integer;
  rubric_count integer;
  public_row_count bigint;
begin
  select count(*) into policy_count
  from private.project_submission_policies
  where is_current;

  select count(*) into rubric_count
  from private.project_rubric_criteria;

  if policy_count <> 8 or rubric_count <> 40 then
    raise exception using
      errcode = '55000',
      message = 'project policy/rubric seed counts are invalid';
  end if;

  if exists (
    select 1
    from private.project_rubric_criteria
    group by project_code, rubric_version
    having count(*) <> 5 or sum(max_points) <> 100
  ) then
    raise exception using
      errcode = '55000',
      message = 'every project rubric must contain five criteria totaling 100 points';
  end if;

  if not exists (
    select 1
    from private.project_submission_policies
    where project_code = 'M02_P02'
      and supporting_text_min_words = 120
      and supporting_text_max_words = 180
  )
    or not exists (
      select 1
      from private.project_submission_policies
      where project_code = 'M08_P08'
        and format_type = 'MULTI_PAGE_PACK'
        and allowed_mime_types = array['application/pdf']::text[]
        and min_page_count = 8
        and max_page_count = 10
    )
  then
    raise exception using
      errcode = '55000',
      message = 'M02 or M08 project policy is invalid';
  end if;

  select count(*) into rls_table_count
  from pg_class as relation
  join pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname in (
      'project_submissions',
      'project_submission_versions',
      'project_submission_files',
      'project_reviews',
      'project_review_criteria',
      'project_status_events'
    )
    and relation.relrowsecurity;

  if rls_table_count <> 6 then
    raise exception using
      errcode = '55000',
      message = 'all six exposed project tables must have RLS enabled';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.project_submissions',
    'INSERT'
  )
    or has_table_privilege(
      'authenticated',
      'public.project_submission_versions',
      'UPDATE'
    )
    or has_table_privilege(
      'authenticated',
      'public.project_reviews',
      'INSERT'
    )
    or has_column_privilege(
      'authenticated',
      'public.project_submission_files',
      'object_path',
      'SELECT'
    )
    or has_column_privilege(
      'authenticated',
      'public.project_reviews',
      'reviewer_id',
      'SELECT'
    )
    or has_column_privilege(
      'authenticated',
      'public.project_status_events',
      'actor_id',
      'SELECT'
    )
  then
    raise exception using
      errcode = '42501',
      message = 'project browser privilege boundary is invalid';
  end if;

  if not has_table_privilege(
    'service_role',
    'public.project_submissions',
    'INSERT'
  )
    or not has_table_privilege(
      'service_role',
      'public.project_submission_versions',
      'INSERT'
    )
    or not has_table_privilege(
      'service_role',
      'public.project_reviews',
      'INSERT'
    )
  then
    raise exception using
      errcode = '42501',
      message = 'project service-role foundation grants are invalid';
  end if;

  select
    (select count(*) from public.project_submissions)
    + (select count(*) from public.project_submission_versions)
    + (select count(*) from public.project_submission_files)
    + (select count(*) from public.project_reviews)
    + (select count(*) from public.project_review_criteria)
    + (select count(*) from public.project_status_events)
  into public_row_count;

  if public_row_count <> 0 then
    raise exception using
      errcode = '55000',
      message = 'Pass 2B1 must not create learner project rows';
  end if;

  if to_regprocedure('public.create_project_draft(text)') is not null
    or to_regprocedure('public.submit_project(uuid)') is not null
    or to_regprocedure('public.begin_project_review(uuid)') is not null
    or to_regprocedure('public.decide_project_review(uuid,text)') is not null
  then
    raise exception using
      errcode = '55000',
      message = 'Pass 2B1 must not activate public workflow RPCs';
  end if;

  if to_regclass('storage.buckets') is not null
    and exists (
      select 1
      from storage.buckets
      where id = 'project-submissions'
    )
  then
    raise exception using
      errcode = '55000',
      message = 'Pass 2B1 must not create the private Storage bucket';
  end if;
end;
$$;

commit;
