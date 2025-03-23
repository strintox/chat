-- Включаем расширение для генерации UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Создаем таблицу пользователей, если она не существует
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar_url TEXT,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Создаем таблицу сообщений, если она не существует
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT REFERENCES public.users(id),
    content TEXT,
    image_url TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Настройка уровня безопасности на уровне строк
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Удаляем существующие политики, если они есть
DROP POLICY IF EXISTS "Пользователи доступны всем для чтения" ON public.users;
DROP POLICY IF EXISTS "Пользователи могут создавать свои профили" ON public.users;
DROP POLICY IF EXISTS "Пользователи могут обновлять только свои профили" ON public.users;
DROP POLICY IF EXISTS "Сообщения доступны всем для чтения" ON public.messages;
DROP POLICY IF EXISTS "Любой может добавлять сообщения" ON public.messages;

-- Создаем новые политики для таблицы пользователей
CREATE POLICY "Пользователи доступны всем для чтения" 
ON public.users FOR SELECT 
USING (true);

CREATE POLICY "Пользователи могут создавать свои профили" 
ON public.users FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Пользователи могут обновлять только свои профили" 
ON public.users FOR UPDATE 
USING (true);

-- Создаем новые политики для таблицы сообщений
CREATE POLICY "Сообщения доступны всем для чтения" 
ON public.messages FOR SELECT 
USING (true);

CREATE POLICY "Любой может добавлять сообщения" 
ON public.messages FOR INSERT 
WITH CHECK (true);

-- Проверка наличия публикации supabase_realtime
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END
$$;

-- Включаем публикацию для реализации реального времени
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Включаем уведомления о вставке для таблицы сообщений для реализации реального времени
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Функция для проверки статуса realtime
CREATE OR REPLACE FUNCTION public.get_realtime_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Проверяем наличие публикации и таблиц в ней
  SELECT jsonb_build_object(
    'has_realtime_publication', EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'),
    'messages_in_publication', EXISTS (
      SELECT 1 
      FROM pg_publication p 
      JOIN pg_publication_tables pt ON p.oid = pt.pubid 
      WHERE p.pubname = 'supabase_realtime' 
      AND pt.tablename = 'messages' 
      AND pt.schemaname = 'public'
    ),
    'replica_identity', (
      SELECT CASE WHEN relreplident = 'f' THEN 'FULL' 
                 WHEN relreplident = 'd' THEN 'DEFAULT'
                 WHEN relreplident = 'n' THEN 'NOTHING'
                 ELSE 'UNKNOWN' END
      FROM pg_class 
      WHERE oid = 'public.messages'::regclass
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Комментарий о хранилищах
COMMENT ON TABLE public.users IS 'Таблица пользователей чата. Аватары теперь выбираются автоматически из предустановленных изображений.'; 