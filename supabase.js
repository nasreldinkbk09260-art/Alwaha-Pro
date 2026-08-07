// supabase.js - تهيئة الاتصال برابط وقواعد بيانات Supabase
const SUPABASE_URL = 'https://fylbbybclbeunmrcscqy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5bGJieWJjbGJldW5tcmNzY3F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5Mzg3NzMsImV4cCI6MjA5NTUxNDc3M30.E-f7VstD2g-uGjE6_z8-VvL6R7Fz3f7eF6K9W2vL8Z4';

export const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
