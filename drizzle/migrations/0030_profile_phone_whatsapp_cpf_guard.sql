CREATE OR REPLACE FUNCTION public.profiles_sync_phone_cpf()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare c text;
begin
  if tg_op = 'INSERT' then
    new.whatsapp := coalesce(nullif(new.whatsapp,''), nullif(new.phone,''));
    new.phone := new.whatsapp;
  else
    if new.whatsapp is distinct from old.whatsapp then
      new.phone := new.whatsapp;
    elsif new.phone is distinct from old.phone then
      new.whatsapp := new.phone;
    end if;
  end if;

  if new.cpf is not null and (tg_op = 'INSERT' or new.cpf is distinct from old.cpf)
     and auth.uid() is not null and auth.uid() = new.user_id then
    c := regexp_replace(new.cpf, '\D', '', 'g');
    if exists (select 1 from public.profiles p where p.user_id <> new.user_id
               and regexp_replace(coalesce(p.cpf,''), '\D', '', 'g') = c) then
      raise exception 'Este CPF já está cadastrado em outra conta.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS profiles_sync_phone_cpf ON public.profiles;
CREATE TRIGGER profiles_sync_phone_cpf BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_sync_phone_cpf();