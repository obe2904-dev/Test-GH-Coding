/**
 * Patchers
 * 
 * Small surgical repairs for specific validation failures.
 * Used after main repairs when validation still finds issues.
 */

export function patchContentPillarsNotesToReferenceHooks(sections: any): any {
  if (!Array.isArray(sections?.content_pillars)) return sections

  const patched = sections.content_pillars.map((p: any) => {
    if (!p || typeof p !== 'object') return p
    if (p.encouraged !== true) return p

    const notes = typeof p.notes === 'string' ? p.notes.trim() : ''
    const hasHookNumber = /#\d+/.test(notes)
    if (hasHookNumber) return p
    const nextNotes = notes ? `${notes} (#1)` : '(#1)'
    return { ...p, notes: nextNotes }
  })

  return { ...sections, content_pillars: patched }
}
