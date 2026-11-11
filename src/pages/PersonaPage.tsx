import PersonaManager from '../components/PersonaManager'

export default function PersonaPage() {
  return (
    <div style={{ height: '100%', padding: '0.75rem 0.9rem', boxSizing: 'border-box', overflow: 'hidden' }}>
      <PersonaManager open embedded onClose={() => undefined} />
    </div>
  )
}
