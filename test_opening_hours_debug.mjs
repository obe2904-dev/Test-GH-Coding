// Test HTML to clean text conversion
const html = `
<h2>Åbningstider</h2>
<p>Mandag – lørdag: 11.30-22.00.</p>
<p>Køkkenet er åbent frem til kl. 21.</p>
`

let text = html
  .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n### H1: $1 ###\n')
  .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## H2: $1 ##\n')
  .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n# H3: $1 #\n')
  .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
  .replace(/<[^>]+>/g, ' ')

console.log('Clean text output:')
console.log(JSON.stringify(text))
console.log('\n---\nLines after split and filter:')
const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
lines.forEach((line, i) => {
  const isHeading = /^#{1,3}\s*h\d:/i.test(line)
  console.log(`${i}: [${isHeading ? 'HEADING' : 'text'}] "${line}"`)
})
