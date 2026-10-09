const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/^['"]|['"]$/g, '');
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim().replace(/^['"]|['"]$/g, '');
const supabase = createClient(url, key);

async function test() {
  console.log("Testing signups...");
  const { error } = await supabase.auth.signUp({
    email: 'husain_test_12345@crewviabni.com',
    password: 'password123'
  });
  console.log('crewviabni.com error:', error ? error.message : 'success');

  const { error: err2 } = await supabase.auth.signUp({
    email: 'husain_test_12345@gmail.com',
    password: 'password123'
  });
  console.log('gmail.com error:', err2 ? err2.message : 'success');
}
test();
