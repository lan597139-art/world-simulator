import { useEffect, useState } from 'react'
import SimulationPage from './SimulationPage'
import WritingPage from './WritingPage'
import '../styles/product-workspace.css'

type Mode = 'simulation' | 'writing'

export default function SimulationWritingPage({
  worldId,
  initialMode = 'simulation',
  seedEventIds,
  simulationAuxiliary = false,
  writingMode = 'narrative',
}: {
  worldId?: string
  initialMode?: Mode
  seedEventIds?: string[]
  simulationAuxiliary?: boolean
  writingMode?: string
}) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [seeds, setSeeds] = useState<string[]>(seedEventIds || [])

  useEffect(() => setMode(initialMode), [initialMode])
  useEffect(() => setSeeds(seedEventIds || []), [seedEventIds?.join(',')])

  return (
    <div className="sw-page">
      <div className="sw-stagebar">
        <div className="sw-stages" role="tablist" aria-label="模拟与写作">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'simulation'}
            className={`sw-stage${mode === 'simulation' ? ' is-active' : ''}`}
            onClick={() => setMode('simulation')}
          >
            <span>01</span>模拟运行
          </button>
          <span className="sw-stage-arrow" aria-hidden="true">→</span>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'writing'}
            className={`sw-stage${mode === 'writing' ? ' is-active' : ''}`}
            onClick={() => setMode('writing')}
          >
            <span>02</span>写作输出
          </button>
        </div>
        <p>同一套世界、事件与推演结果；模拟完成后直接进入写作。</p>
      </div>

      <div className="sw-body">
        {mode === 'simulation' ? (
          <SimulationPage
            embedded
            worldId={worldId}
            auxiliary={simulationAuxiliary}
            onWriteChapter={(eventId) => {
              setSeeds([eventId])
              setMode('writing')
            }}
          />
        ) : (
          <WritingPage worldId={worldId} seedEventIds={seeds} productMode={writingMode} />
        )}
      </div>
    </div>
  )
}
