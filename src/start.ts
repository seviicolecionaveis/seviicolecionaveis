import { createStart } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

export const startInstance = createStart(() => ({
  requestMiddleware: [
    async ({ request, next }) => {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/lovable/") || url.pathname === "/email/unsubscribe") {
        return next();
      }
      return next();
    },
  ],
  functionMiddleware: [attachSupabaseAuth],
}));
