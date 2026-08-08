-- Photo feed backend, shared by /gallery and the main feed on /community.
-- Photos live in a public Supabase Storage bucket; only the owner can upload
-- into their own folder (enforced by the storage policy below).

INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery', 'gallery', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "gallery photos are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery');

CREATE POLICY "users upload only into their own gallery folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users delete only their own gallery photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'gallery' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE TABLE public.gallery_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL, -- storage object path, e.g. "<user_id>/<uuid>.jpg"
  caption TEXT,
  place TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gallery_posts TO anon;
GRANT SELECT, INSERT, DELETE ON public.gallery_posts TO authenticated;
ALTER TABLE public.gallery_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read posts" ON public.gallery_posts
  FOR SELECT USING (true);
CREATE POLICY "users create their own posts" ON public.gallery_posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete their own posts" ON public.gallery_posts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.gallery_likes (
  post_id UUID NOT NULL REFERENCES public.gallery_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT ON public.gallery_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.gallery_likes TO authenticated;
ALTER TABLE public.gallery_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read likes" ON public.gallery_likes
  FOR SELECT USING (true);
CREATE POLICY "users like as themselves" ON public.gallery_likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users unlike their own like" ON public.gallery_likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.gallery_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.gallery_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gallery_comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.gallery_comments TO authenticated;
ALTER TABLE public.gallery_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read comments" ON public.gallery_comments
  FOR SELECT USING (true);
CREATE POLICY "users comment as themselves" ON public.gallery_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete their own comments" ON public.gallery_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
