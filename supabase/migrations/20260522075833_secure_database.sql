-- Drop policy duplicate to keep it clean
DROP POLICY IF EXISTS profiles_update ON public.profiles;

-- Profile Protection Trigger Function
CREATE OR REPLACE FUNCTION public.clean_and_protect_profile()
RETURNS TRIGGER AS $$
DECLARE
  current_user_email text;
BEGIN
  -- Get email from auth JWT (safest way in Supabase)
  current_user_email := auth.jwt() ->> 'email';

  -- Check if it's an INSERT
  IF TG_OP = 'INSERT' THEN
    -- A user can only create their own profile (ID must match auth.uid()), unless it is the admin
    IF (auth.uid() IS NOT NULL AND auth.uid() <> NEW.id AND (current_user_email IS NULL OR current_user_email <> 'sargsyanaren218@gmail.com')) THEN
      RAISE EXCEPTION 'You can only create your own profile.';
    END IF;
    
    -- If not the admin, force default values for sensitive columns
    IF (current_user_email IS NULL OR current_user_email <> 'sargsyanaren218@gmail.com') THEN
      NEW.is_approved := false;
      NEW.is_sponsored := false;
      NEW.rating := 5.0;
      NEW.reviews := 0;
    END IF;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- If not the admin, prevent changing sensitive columns
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

-- Bind Trigger to Profiles
DROP TRIGGER IF EXISTS before_profile_insert_or_update ON public.profiles;

CREATE TRIGGER before_profile_insert_or_update
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.clean_and_protect_profile();


-- Appointments Protection Trigger Function
CREATE OR REPLACE FUNCTION public.clean_and_protect_appointments()
RETURNS TRIGGER AS $$
DECLARE
  current_user_email text;
BEGIN
  current_user_email := auth.jwt() ->> 'email';

  IF TG_OP = 'INSERT' THEN
    -- Force patient_id to the authenticated user's ID, unless it is the admin
    IF (current_user_email IS NULL OR current_user_email <> 'sargsyanaren218@gmail.com') THEN
      NEW.patient_id := auth.uid();
      NEW.status := 'pending';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If not the admin, protect identifiers and validate status
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
      IF NEW.status NOT IN ('pending', 'confirmed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status value.';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind Trigger to Appointments
DROP TRIGGER IF EXISTS before_appointment_insert_or_update ON public.appointments;

CREATE TRIGGER before_appointment_insert_or_update
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.clean_and_protect_appointments();
