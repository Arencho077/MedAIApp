-- Security hardening for MedAIArmenia

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Profile protection
CREATE OR REPLACE FUNCTION public.clean_and_protect_profile()
RETURNS TRIGGER AS $$
DECLARE
  current_user_email text;
BEGIN
  current_user_email := auth.jwt() ->> 'email';

  IF TG_OP = 'INSERT' THEN
    IF (
      auth.uid() IS NOT NULL
      AND auth.uid() <> NEW.id
      AND (current_user_email IS NULL OR current_user_email <> 'sargsyanaren218@gmail.com')
    ) THEN
      RAISE EXCEPTION 'You can only create your own profile.';
    END IF;

    IF (current_user_email IS NULL OR current_user_email <> 'sargsyanaren218@gmail.com') THEN
      NEW.is_approved := false;
      NEW.is_sponsored := false;
      NEW.rating := COALESCE(NEW.rating, 5.0);
      NEW.reviews := COALESCE(NEW.reviews, 0);
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF (current_user_email IS NULL OR current_user_email <> 'sargsyanaren218@gmail.com') THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_profile_insert_or_update ON public.profiles;

CREATE TRIGGER before_profile_insert_or_update
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.clean_and_protect_profile();

-- Appointment protection
CREATE OR REPLACE FUNCTION public.clean_and_protect_appointments()
RETURNS TRIGGER AS $$
DECLARE
  current_user_email text;
BEGIN
  current_user_email := auth.jwt() ->> 'email';

  IF TG_OP = 'INSERT' THEN
    IF (current_user_email IS NULL OR current_user_email <> 'sargsyanaren218@gmail.com') THEN
      NEW.patient_id := auth.uid();
      NEW.status := 'pending';
    END IF;

    IF NEW.doctor_id IS NOT NULL
      AND NEW.appointment_date IS NOT NULL
      AND NEW.status IN ('pending', 'confirmed')
      AND EXISTS (
        SELECT 1
        FROM public.appointments a
        WHERE a.doctor_id = NEW.doctor_id
          AND a.appointment_date = NEW.appointment_date
          AND a.status IN ('pending', 'confirmed')
      )
    THEN
      RAISE EXCEPTION 'This time slot is already booked.';
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF (current_user_email IS NULL OR current_user_email <> 'sargsyanaren218@gmail.com') THEN
      IF OLD.patient_id IS DISTINCT FROM NEW.patient_id THEN
        RAISE EXCEPTION 'Cannot change patient_id.';
      END IF;
      IF OLD.doctor_id IS DISTINCT FROM NEW.doctor_id THEN
        RAISE EXCEPTION 'Cannot change doctor_id.';
      END IF;
      IF OLD.id IS DISTINCT FROM NEW.id THEN
        RAISE EXCEPTION 'Cannot change appointment id.';
      END IF;
      IF OLD.appointment_date IS DISTINCT FROM NEW.appointment_date THEN
        RAISE EXCEPTION 'Cannot change appointment_date.';
      END IF;
      IF OLD.notes IS DISTINCT FROM NEW.notes THEN
        RAISE EXCEPTION 'Cannot change notes.';
      END IF;
      IF OLD.doctor_name IS DISTINCT FROM NEW.doctor_name THEN
        RAISE EXCEPTION 'Cannot change doctor_name.';
      END IF;
      IF NEW.status NOT IN ('pending', 'confirmed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status value.';
      END IF;
    END IF;

    IF NEW.doctor_id IS NOT NULL
      AND NEW.appointment_date IS NOT NULL
      AND NEW.status IN ('pending', 'confirmed')
      AND EXISTS (
        SELECT 1
        FROM public.appointments a
        WHERE a.doctor_id = NEW.doctor_id
          AND a.appointment_date = NEW.appointment_date
          AND a.status IN ('pending', 'confirmed')
          AND a.id IS DISTINCT FROM OLD.id
      )
    THEN
      RAISE EXCEPTION 'This time slot is already booked.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_appointment_insert_or_update ON public.appointments;

CREATE TRIGGER before_appointment_insert_or_update
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.clean_and_protect_appointments();

-- Admin RPCs
CREATE OR REPLACE FUNCTION public.admin_approve_doctor(doctor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.jwt() ->> 'email' <> 'sargsyanaren218@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.profiles
  SET is_approved = true
  WHERE id = doctor_id
    AND role = 'doctor';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_doctor(doctor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.jwt() ->> 'email' <> 'sargsyanaren218@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
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
END;
$$;

-- Profile read access: only owners, approved doctors, and admin
DROP POLICY IF EXISTS "Anyone can view doctors" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Approved doctors can be viewed publicly"
  ON public.profiles
  FOR SELECT
  USING (role = 'doctor' AND is_approved = true);

CREATE POLICY "Admin can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (auth.email() = 'sargsyanaren218@gmail.com');

