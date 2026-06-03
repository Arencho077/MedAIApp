-- Harden SECURITY DEFINER functions and align admin checks.

CREATE OR REPLACE FUNCTION public.clean_and_protect_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean;
BEGIN
  caller_is_admin := public.is_admin();

  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL AND auth.uid() <> NEW.id AND NOT caller_is_admin THEN
      RAISE EXCEPTION 'You can only create your own profile.';
    END IF;

    IF NOT caller_is_admin THEN
      NEW.is_approved := false;
      NEW.is_sponsored := false;
      NEW.rating := COALESCE(NEW.rating, 5.0);
      NEW.reviews := COALESCE(NEW.reviews, 0);
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT caller_is_admin THEN
      IF OLD.role IS DISTINCT FROM NEW.role THEN
        RAISE EXCEPTION 'Cannot change role after registration.';
      END IF;
      IF OLD.is_approved IS DISTINCT FROM NEW.is_approved THEN
        RAISE EXCEPTION 'Cannot change approval status.';
      END IF;
      IF OLD.rating IS DISTINCT FROM NEW.rating THEN
        RAISE EXCEPTION 'Cannot change rating.';
      END IF;
      IF OLD.reviews IS DISTINCT FROM NEW.reviews THEN
        RAISE EXCEPTION 'Cannot change reviews count.';
      END IF;
      IF OLD.is_sponsored IS DISTINCT FROM NEW.is_sponsored THEN
        RAISE EXCEPTION 'Cannot change sponsored status.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_doctor(doctor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  UPDATE public.profiles
  SET is_approved = true
  WHERE id = doctor_id
    AND role = 'doctor';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Doctor not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_doctor(doctor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  UPDATE public.profiles
  SET role = 'patient',
      is_approved = false,
      is_sponsored = false,
      specialty = NULL,
      experience = NULL,
      clinic_address = NULL,
      diploma_url = NULL,
      social_link = NULL
  WHERE id = doctor_id
    AND role = 'doctor';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Doctor not found';
  END IF;
END;
$$;

