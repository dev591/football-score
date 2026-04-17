const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://wwbdglgeekgkiaohbcov.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3YmRnbGdlZWtna2lhb2hiY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIzOTA2NywiZXhwIjoyMDkxODE1MDY3fQ.VJTgN-JKpd0yIXcMhfwzFT1tGqvJh_AuI62nijpR94I'
);

async function getStandings() {
  const { data: matches } = await supabase.from('matches').select('*');
  const { data: teams } = await supabase.from('teams').select('*');

  const standingsMap = {};
  teams.forEach(team => {
    standingsMap[team.id] = {
      team: team.name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goals_for: 0,
      goals_against: 0,
      points: 0
    };
  });

  const processedMatches = matches.filter(m => 
    m.status === 'ft' || (m.score_a !== null && m.score_b !== null)
  );

  processedMatches.forEach(match => {
    const home = standingsMap[match.team_a_id];
    const away = standingsMap[match.team_b_id];
    if (home && away) {
      home.played++;
      away.played++;
      home.goals_for += (match.score_a || 0);
      home.goals_against += (match.score_b || 0);
      away.goals_for += (match.score_b || 0);
      away.goals_against += (match.score_a || 0);

      let winner = null;
      if (match.result_override) {
        if (match.result_override === 'team_a') winner = 'a';
        else if (match.result_override === 'team_b') winner = 'b';
        else if (match.result_override === 'draw') winner = 'draw';
      } else {
        if ((match.score_a || 0) > (match.score_b || 0)) winner = 'a';
        else if ((match.score_b || 0) > (match.score_a || 0)) winner = 'b';
        else winner = 'draw';
      }

      if (winner === 'a') { home.won++; home.points += 3; away.lost++; }
      else if (winner === 'b') { away.won++; away.points += 3; home.lost++; }
      else { home.drawn++; away.drawn++; home.points += 1; away.points += 1; }
    }
  });

  const standings = Object.values(standingsMap).map(team => ({
    ...team,
    goal_difference: team.goals_for - team.goals_against
  })).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
    return b.goals_for - a.goals_for;
  });

  console.log(JSON.stringify(standings, null, 2));
}

getStandings();
