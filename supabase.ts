import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the environment before using the ordering app."
    : "";

// Keep module evaluation safe so the UI can explain configuration issues instead
// of failing before React mounts. Requests remain inert until valid env values exist.
export const supabase = createClient(
  supabaseUrl || "https://configuration.invalid",
  supabaseAnonKey || "configuration-missing",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the environment before using the ordering app."
    : "";

// Keep module evaluation safe so the UI can explain configuration issues instead
// of failing before React mounts. Requests remain inert until valid env values exist.
export const supabase = createClient(
  supabaseUrl || "https://configuration.invalid",
  supabaseAnonKey || "configuration-missing",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the environment before using the ordering app."
    : "";

// Keep module evaluation safe so the UI can explain configuration issues instead
// of failing before React mounts. Requests remain inert until valid env values exist.
export const supabase = createClient(
  supabaseUrl || "https://configuration.invalid",
  supabaseAnonKey || "configuration-missing",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the environment before using the ordering app."
    : "";

// Keep module evaluation safe so the UI can explain configuration issues instead
// of failing before React mounts. Requests remain inert until valid env values exist.
export const supabase = createClient(
  supabaseUrl || "https://configuration.invalid",
  supabaseAnonKey || "configuration-missing",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
