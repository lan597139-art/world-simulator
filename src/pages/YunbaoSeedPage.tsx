import { useEffect, useState } from 'react'
import CharacterBuildingPage from './CharacterBuildingPage'
import { getYunbaoSeedCharacter } from '../api/yunbao'

export default function YunbaoSeedPage({ onBack }: { onBack: () => void }) {
  const [characterId, setCharacterId] = useState('')
  const [worldId, setWorldId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    void getYunbaoSeedCharacter()
      .then((data) => {
        if (!alive) return
        setCharacterId(data.character_id)
        setWorldId(data.world_id)
      })
      .catch((err) => { if (alive) setError(String(err?.message || err)) })
    return () => { alive = false }
  }, [])

  if (error) {
    return (
      <div style={{ padding: 30, maxWidth: 760, margin: '0 auto', fontSize: 12, color: 'var(--danger-color)' }}>
        无法打开云宝人物种子编辑器：{error}
      </div>
    )
  }
  if (!characterId) {
    return <div style={{ padding: 30, color: 'var(--text-muted)', fontSize: 12 }}>正在准备云宝人物种子…</div>
  }
  return <CharacterBuildingPage characterId={characterId} worldId={worldId} onBack={onBack} />
}
