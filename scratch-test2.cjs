const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/^['"]|['"]$/g, '');
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim().replace(/^['"]|['"]$/g, '');
const supabase = createClient(url, key);

async function test() {
  const { error } = await supabase.auth.signUp({
    email: 'husain@crewviabni.com',
    password: 'password123'
  });
  console.log('Error:', error ? error.message : 'success');
}
test();
