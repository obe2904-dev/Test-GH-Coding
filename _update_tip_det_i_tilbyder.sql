-- Update tip #5 to use "Det I tilbyder" instead of "Det du tilbyder"

UPDATE dashboard_tips
SET tip_da = 'Vil du have flere opslag om en bestemt ret? Tryk på ☆ ud for retten under Det I tilbyder. Du kan altid fortryde det igen.'
WHERE tip_da = 'Vil du have flere opslag om en bestemt ret? Tryk på ☆ ud for retten under Det du tilbyder. Du kan altid fortryde det igen.';
