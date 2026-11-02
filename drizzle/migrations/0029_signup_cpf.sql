CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  bd date;
  c text;
begin
  begin
    bd := nullif(new.raw_user_meta_data ->> 'birth_date','')::date;
  exception when others then
    bd := null;
  end;
  c := nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'cpf',''), '\D', '', 'g'), '');
  if c is not null and (length(c) <> 11 or exists (select 1 from public.profiles p where regexp_replace(coalesce(p.cpf,''), '\D', '', 'g') = c)) then
    c := null;
  end if;

  insert into public.profiles (user_id, full_name, whatsapp, birth_date, cpf)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'whatsapp',''), bd, c);

  if lower(new.email) = 'seviicolecionaveis@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end;
$function$;