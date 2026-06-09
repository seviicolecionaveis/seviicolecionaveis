
REVOKE EXECUTE ON FUNCTION public.user_lifetime_earned(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_tier(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_tier_multiplier_bp(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.expire_old_loyalty_points() FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.user_lifetime_earned(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_tier(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_tier_multiplier_bp(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_old_loyalty_points() TO service_role;
