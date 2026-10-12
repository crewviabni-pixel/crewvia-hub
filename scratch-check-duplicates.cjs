const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://mawmjqeyjzktxbtsswgw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_pfNJYlL8rRY3xU1_VjMkew_LvgWsLFf";

function isNewSupabaseApiKey(value) {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey) {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );
    if (init && init.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }
    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: {
    fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
  }
});

async function findDuplicates() {
  const { data: workspaces, error: wErr } = await supabase.from('workspaces').select('*');
  if (wErr) {
    console.error("Workspace Error:", wErr);
    return;
  }
  const campaign = workspaces.find(w => w.name.includes("9") || w.name.includes("10") || w.name.includes("26") || w.name.toLowerCase().includes("camp"));
  if (!campaign) {
    console.error("Campaign not found. All workspaces:", workspaces.map(w => w.name));
    return;
  }
  
  console.log(`Found campaign: ${campaign.name} (${campaign.id})`);

  const { data: leads, error: lErr } = await supabase.from('leads').select('*').eq('workspace_id', campaign.id);
  if (lErr) {
    console.error("Leads error:", lErr);
    return;
  }

  console.log(`Found ${leads.length} leads in campaign.`);

  const normalizePhone = (p) => {
    if (!p) return "";
    const digits = p.replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
  };

  const phoneGroups = {};
  leads.forEach(lead => {
    const p = normalizePhone(lead.phone);
    if (!phoneGroups[p]) phoneGroups[p] = [];
    phoneGroups[p].push(lead);
  });

  let duplicateGroups = 0;
  for (const [phone, group] of Object.entries(phoneGroups)) {
    if (group.length > 1) {
      duplicateGroups++;
      console.log(`Duplicate Group (${phone}):`);
      group.forEach(g => console.log(`  - ID: ${g.id}, Name: ${g.name}, Phone: ${g.phone}, Source: ${g.source}`));
    }
  }

  console.log(`Found ${duplicateGroups} duplicate groups.`);
}

findDuplicates();
