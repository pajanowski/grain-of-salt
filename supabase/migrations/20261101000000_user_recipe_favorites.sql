-- Junction table for multi-user recipe favorites.
-- Decouples user favorites from recipe_nodes.is_favorite so users can favorite
-- both their own recipes and shared public recipes created by other users without
-- write contention or ownership violations.

CREATE TABLE public.user_recipe_favorites (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipe_node_id UUID NOT NULL REFERENCES public.recipe_nodes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, recipe_node_id)
);

CREATE INDEX idx_user_recipe_favorites_user_created 
    ON public.user_recipe_favorites (user_id, created_at DESC, recipe_node_id);

CREATE INDEX idx_user_recipe_favorites_recipe_node 
    ON public.user_recipe_favorites (recipe_node_id);

ALTER TABLE public.user_recipe_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
    ON public.user_recipe_favorites FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites on owned or public recipes"
    ON public.user_recipe_favorites FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND EXISTS (
            SELECT 1 FROM public.recipe_nodes rn
            WHERE rn.id = recipe_node_id AND (rn.owner_id = auth.uid() OR rn.is_public = true)
        )
    );

CREATE POLICY "Users can delete own favorites"
    ON public.user_recipe_favorites FOR DELETE
    USING (auth.uid() = user_id);

-- Backfill legacy is_favorite rows into user_recipe_favorites
INSERT INTO public.user_recipe_favorites (user_id, recipe_node_id, created_at)
SELECT owner_id, id, updated_at
FROM public.recipe_nodes
WHERE is_favorite = true
ON CONFLICT DO NOTHING;
