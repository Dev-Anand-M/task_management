-- Create a table for AI history (if not exists)
create table if not exists public.ai_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  tool text not null, -- 'assistant', 'code_review', 'quiz', 'learning_path'
  title text, -- Optional title for the history item
  content jsonb not null, -- Stores the actual conversation or result
  model_used text, -- Store which model was used
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.ai_history enable row level security;

-- Create policies (Drop first to avoid errors if they exist)
drop policy if exists "Users can view their own AI history" on public.ai_history;
create policy "Users can view their own AI history"
  on public.ai_history for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own AI history" on public.ai_history;
create policy "Users can insert their own AI history"
  on public.ai_history for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own AI history" on public.ai_history;
create policy "Users can delete their own AI history"
  on public.ai_history for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own AI history" on public.ai_history;
create policy "Users can update their own AI history"
  on public.ai_history for update
  using (auth.uid() = user_id);

-- Create index for faster queries (if not exists)
create index if not exists ai_history_user_id_idx on public.ai_history(user_id);
create index if not exists ai_history_tool_idx on public.ai_history(tool);
