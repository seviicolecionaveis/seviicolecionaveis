import { createStart, createMiddleware } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const bypassMiddleware = createMiddleware().server(({ request, next }) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/lovable/")) {
    return next();
  }
  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [bypassMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
