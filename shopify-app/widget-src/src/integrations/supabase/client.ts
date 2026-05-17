import { createClient } from '@supabase/supabase-js';
import { WidgetConfig } from '../../../widget-main';

export const supabase = createClient(
  WidgetConfig.supabaseUrl || "https://placeholder.supabase.co",
  WidgetConfig.supabaseAnonKey || "placeholder_key"
);
