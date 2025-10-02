import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://teyxeoapdsvqdsidoiwh.supabase.co'; // Например: 'https://xyz.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRleXhlb2FwZHN2cWRzaWRvaXdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NzgyOTIsImV4cCI6MjA3NDQ1NDI5Mn0.7XYLNmcuymHhi34QJh5PvXGm9cEXqDxd5GWTYGvdm6o'; // Например: 'eyJhbGciOiJIU...'

export const supabase = createClient(supabaseUrl, supabaseAnonKey);