import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  Compass,
  Flag,
  Gamepad2,
  GitBranch,
  Map,
  Route,
  Swords,
  Users,
} from 'lucide-react'
import { getBranch, listBranches, listEndings as listSimulationEndings, type Branch, type BranchDetail, type Ending } from '../api/multipath'
import {
  getStory,
  listChoices,
  listStories as listStoryProjects,
  type StoryChoice,
  type StoryDetail,
  type StoryProject,
} from '../api/storyline'
import type { Lang } from './centerShared'
import { apiGet, BRANCH_STATUS_LABELS, excerpt, fetchWorlds, formatDate, initialOf, STORY_STATUS_LABELS, toCharacter, type BasicCharacter } from './centerShared'
import './../styles/centers.css'

function copyFor(lang: Lang) {
  return lang === 'zh'
    ? {
        eyebrow: 'GAME EXPERIENCE CENTER',
        title: '游戏体验中心',
        subtitle: '进入世界，选择角色，在分支与事件之间走出属于自己的故事。',
        continueGame: '继续游戏',
        explore: '世界探索',
        stories: '剧情项目',
        branches: '游戏分支',
        endings: '已记录结局',
        nodes: '剧情节点',
        storyKicker: 'INTERACTIVE STORY',
        storyZone: '剧情游戏',
        enterGame: '进入游戏',
        openStoryline: '故事线',
        status: '状态',
        spaces: '故事空间',
        choices: '选择',
        noStory: '还没有剧情项目',
        noStoryHint: '在故事线中创建项目后，这里会出现可体验的剧情。',
        progressKicker: 'CURRENT RUN',
        progress: '我的进度',
        currentBranch: '当前分支',
        latestNode: '最新节点',
        saved: '分支进度已保存',
        nodeCount: '节点',
        choiceRecorded: '已记录选择',
        noProgress: '还没有进行中的分支',
        noProgressHint: '进入多路径沙盒创建分支后，进度会出现在这里。',
        myGames: '我的游戏',
        myGamesKicker: 'SAVED RUNS',
        noGames: '还没有游戏记录',
        endingUnit: '结局',
        roleplay: '角色扮演',
        roleplayKicker: 'PLAY A CHARACTER',
        roleplayDesc: '以指定角色身份进入模拟，让立场与关系影响剧情走向。',
        selectCharacter: '选择角色',
        enterSimulation: '进入模拟',
        multiplayer: '多人体验',
        multiplayerKicker: 'MULTIPLAYER',
        multiplayerEmpty: '暂无多人游戏房间',
        multiplayerHint: '多人协作与联机剧情尚未接入；当前为单用户分支体验。',
        publishTitle: '作品与评价',
        publishEmpty: '0 个已发布游戏 · 0 条体验评价',
        publishHint: '游戏作品发布与评价暂无后端，当前剧情项目仍可在故事线中编辑。',
        endingKicker: 'ENDING GALLERY',
        endingGallery: '结局图鉴',
        unlocked: '已记录',
        noEndings: '还没有记录结局',
        final: '终局',
        openEnding: '开放结局',
        worldKicker: 'WORLD EXPLORATION',
        worldExplore: '世界探索',
        enterWorld: '进入世界',
        worldData: '世界设定',
        worldStructure: '世界结构',
        relationships: '人物关系',
        note: '游戏体验复用现有故事线、多路径分支、模拟与结局能力；多人联机、发布和评价暂无后端。',
      }
    : {
        eyebrow: 'GAME EXPERIENCE CENTER',
        title: 'Game Experience Center',
        subtitle: 'Enter a world, choose a role, and carve your own path through branches and events.',
        continueGame: 'Continue',
        explore: 'Explore world',
        stories: 'Story projects',
        branches: 'Runs',
        endings: 'Recorded endings',
        nodes: 'Story nodes',
        storyKicker: 'INTERACTIVE STORY',
        storyZone: 'Story games',
        enterGame: 'Enter game',
        openStoryline: 'Storyline',
        status: 'Status',
        spaces: 'Spaces',
        choices: 'Choices',
        noStory: 'No story projects yet',
        noStoryHint: 'Create a story project in Storyline and playable stories will appear here.',
        progressKicker: 'CURRENT RUN',
        progress: 'My progress',
        currentBranch: 'Current run',
        latestNode: 'Latest node',
        saved: 'Branch progress is saved',
        nodeCount: 'nodes',
        choiceRecorded: 'recorded choices',
        noProgress: 'No active run yet',
        noProgressHint: 'Create a branch in Multi-path Sandbox and progress will appear here.',
        myGames: 'My games',
        myGamesKicker: 'SAVED RUNS',
        noGames: 'No saved runs yet',
        endingUnit: 'endings',
        roleplay: 'Roleplay',
        roleplayKicker: 'PLAY A CHARACTER',
        roleplayDesc: 'Enter simulation as a selected character and let stance and relationships shape the story.',
        selectCharacter: 'Choose character',
        enterSimulation: 'Enter simulation',
        multiplayer: 'Multiplayer',
        multiplayerKicker: 'MULTIPLAYER',
        multiplayerEmpty: 'No multiplayer rooms',
        multiplayerHint: 'Co-op and online story sessions are not connected. Runs are currently single-user.',
        publishTitle: 'Publishing & reviews',
        publishEmpty: '0 published games · 0 reviews',
        publishHint: 'Game publishing and reviews have no backend. Story projects remain editable in Storyline.',
        endingKicker: 'ENDING GALLERY',
        endingGallery: 'Ending gallery',
        unlocked: 'recorded',
        noEndings: 'No endings recorded',
        final: 'Final',
        openEnding: 'Open',
        worldKicker: 'WORLD EXPLORATION',
        worldExplore: 'World exploration',
        enterWorld: 'Enter world',
        worldData: 'World settings',
        worldStructure: 'World structure',
        relationships: 'Relationships',
        note: 'Game experience reuses existing Storyline, Multi-path branches, simulation, and ending capabilities. Multiplayer, publishing, and reviews have no backend yet.',
      }
}

export default function GameCenterPage({
  lang,
  onOpenMultipath,
  onOpenSimulation,
  onOpenStoryline,
  onOpenCharacters,
  onOpenWorld,
  onOpenWorldData,
  onOpenWorldStructure,
  onOpenRelationships,
}: {
  lang: Lang
  onOpenMultipath: () => void
  onOpenSimulation: () => void
  onOpenStoryline: () => void
  onOpenCharacters: () => void
  onOpenWorld: () => void
  onOpenWorldData: () => void
  onOpenWorldStructure: () => void
  onOpenRelationships: () => void
}) {
  const copy = copyFor(lang)
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchDetail, setBranchDetail] = useState<BranchDetail | null>(null)
  const [story, setStory] = useState<StoryDetail | null>(null)
  const [characters, setCharacters] = useState<BasicCharacter[]>([])
  const [choices, setChoices] = useState<StoryChoice[]>([])
  const [simulationEndings, setSimulationEndings] = useState<Ending[]>([])
  const [worldName, setWorldName] = useState('')
  const [worldDescription, setWorldDescription] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const worlds = await fetchWorlds(false)
        const world = worlds.find((item) => item.product_scene === 'game' && !item.is_product_workspace) || worlds[0]
        if (!world) return
        setWorldName(world.name)
        setWorldDescription(world.description || world.background || '')
        const [branchRows, storyRows, characterRows, simEndingRows] = await Promise.all([
          listBranches(world.id).catch(() => []),
          listStoryProjects(world.id).catch(() => [] as StoryProject[]),
          apiGet<any[]>('/characters').catch(() => []),
          listSimulationEndings(world.id).catch(() => [] as Ending[]),
        ])
        if (cancelled) return
        const sortedBranches = [...branchRows].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
        setBranches(sortedBranches)
        setCharacters(characterRows.map((row) => toCharacter(row, worlds)).filter((character) => character.worldId === world.id))
        setSimulationEndings(simEndingRows)

        if (sortedBranches[0]) {
          const detail = await getBranch(sortedBranches[0].id).catch(() => null)
          if (!cancelled) setBranchDetail(detail)
        }
        if (storyRows[0]) {
          const storyDetail = await getStory(storyRows[0].id).catch(() => null)
          if (cancelled) return
          setStory(storyDetail)
          if (storyDetail?.spaces[0]) {
            const choiceRows = await listChoices(storyDetail.spaces[0].id).catch(() => [] as StoryChoice[])
            if (!cancelled) setChoices(choiceRows)
          }
        }
      } catch {
        /* honest empty states */
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const storyEndings = story?.endings || []
  const endingCount = storyEndings.length + simulationEndings.length
  const nodeCount = branches.reduce((sum, branch) => sum + (branch.node_count || 0), 0)
  const activeBranch = branches[0] || null
  const latestNode = branchDetail?.nodes[branchDetail.nodes.length - 1] || null
  const activeChoice = choices[0] || null
  const storyGames = story ? 1 : 0
  const roleCharacters = useMemo(() => characters.slice(0, 4), [characters])

  return (
    <div className="ct-content gx-content">
      <section className="ct-hero">
        <div className="ct-hero-copy">
          <div className="ct-eyebrow">{copy.eyebrow}</div>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <div className="ct-hero-actions">
          <div className="ct-stats">
            <div><strong>{loaded ? storyGames : '—'}</strong><span>{copy.stories}</span></div>
            <div><strong>{loaded ? branches.length : '—'}</strong><span>{copy.branches}</span></div>
            <div><strong>{loaded ? endingCount : '—'}</strong><span>{copy.endings}</span></div>
            <div><strong>{loaded ? nodeCount : '—'}</strong><span>{copy.nodes}</span></div>
          </div>
          <button type="button" className="ct-primary" onClick={onOpenMultipath}>
            <Gamepad2 aria-hidden="true" strokeWidth={1.7} />
            {copy.continueGame}
          </button>
        </div>
      </section>

      <div className="ct-top-grid gx-top-grid">
        <section className="ct-section gx-feature">
          <div className="ct-section-head">
            <div>
              <span className="ct-kicker">{copy.storyKicker}</span>
              <h2>{copy.storyZone}</h2>
            </div>
            <BookOpen aria-hidden="true" strokeWidth={1.5} />
          </div>
          {!story ? (
            <div className="ct-empty"><BookOpen aria-hidden="true" strokeWidth={1.4} /><strong>{copy.noStory}</strong><p>{copy.noStoryHint}</p></div>
          ) : (
            <div className="gx-feature-body">
              <div className="gx-feature-cover">
                <span className="gx-feature-world">{worldName || '—'}</span>
                <span className={`gx-status ${story.status}`}>{STORY_STATUS_LABELS[story.status]?.[lang] || story.status}</span>
              </div>
              <div className="gx-feature-copy">
                <h3>{story.title}</h3>
                <p>{excerpt(story.premise, 190) || worldDescription}</p>
                <div className="gx-feature-meta">
                  <span>{story.space_count} {copy.spaces}</span>
                  <span>{storyEndings.length} {copy.endingUnit}</span>
                  <span>{choices.length} {copy.choices}</span>
                  <span>{characterCount(characters)} {lang === 'zh' ? '角色' : 'characters'}</span>
                </div>
                <div className="gx-feature-actions">
                  <button type="button" className="ct-primary" onClick={onOpenMultipath}>{copy.enterGame} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} /></button>
                  <button type="button" className="ct-ghost" onClick={onOpenStoryline}>{copy.openStoryline} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} /></button>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="ct-section gx-progress">
          <div className="ct-section-head">
            <div>
              <span className="ct-kicker">{copy.progressKicker}</span>
              <h2>{copy.progress}</h2>
            </div>
            <Route aria-hidden="true" strokeWidth={1.5} />
          </div>
          {!activeBranch ? (
            <div className="ct-empty"><Route aria-hidden="true" strokeWidth={1.4} /><strong>{copy.noProgress}</strong><p>{copy.noProgressHint}</p></div>
          ) : (
            <div className="gx-progress-body">
              <div className="gx-progress-branch">
                <span className={`gx-branch-dot ${activeBranch.status}`} />
                <div>
                  <small>{copy.currentBranch}</small>
                  <strong>{activeBranch.name}</strong>
                </div>
                <span className={`gx-status ${activeBranch.status}`}>{BRANCH_STATUS_LABELS[activeBranch.status]?.[lang] || activeBranch.status}</span>
              </div>
              <div className="gx-latest-node">
                <small>{copy.latestNode}</small>
                <p>{latestNode?.summary || activeBranch.note || copy.saved}</p>
              </div>
              <div className="gx-progress-stats">
                <div><strong>{activeBranch.node_count || 0}</strong><span>{copy.nodeCount}</span></div>
                <div><strong>{activeBranch.ending_count || 0}</strong><span>{copy.endingUnit}</span></div>
                <div><strong>{choices.length}</strong><span>{copy.choiceRecorded}</span></div>
              </div>
              {activeChoice && <div className="gx-choice"><span>{activeChoice.status}</span><strong>{activeChoice.title}</strong></div>}
              <div className="gx-saved"><span className="gx-saved-dot" />{copy.saved}</div>
              <button type="button" className="ct-primary" onClick={onOpenMultipath}>{copy.continueGame} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} /></button>
            </div>
          )}
        </section>
      </div>

      <section className="ct-section gx-runs">
        <div className="ct-section-head">
          <div>
            <span className="ct-kicker">{copy.myGamesKicker}</span>
            <h2>{copy.myGames}</h2>
          </div>
          <GitBranch aria-hidden="true" strokeWidth={1.5} />
        </div>
        {!loaded ? (
          <div className="ct-loading">{lang === 'zh' ? '正在读取游戏分支…' : 'Loading runs…'}</div>
        ) : branches.length === 0 ? (
          <div className="ct-empty large"><Gamepad2 aria-hidden="true" strokeWidth={1.4} /><strong>{copy.noGames}</strong><p>{copy.noProgressHint}</p></div>
        ) : (
          <div className="gx-run-grid">
            {branches.map((branch) => (
              <button type="button" className="gx-run-card" key={branch.id} onClick={onOpenMultipath}>
                <div className="gx-run-top">
                  <span className={`gx-status ${branch.status}`}>{BRANCH_STATUS_LABELS[branch.status]?.[lang] || branch.status}</span>
                  <small>{formatDate(branch.updated_at, lang)}</small>
                </div>
                <strong>{branch.name}</strong>
                <p>{excerpt(branch.note, 62) || (lang === 'zh' ? '分支进度自动保存，可继续推演。' : 'Run progress is auto-saved and can continue.')}</p>
                <div className="gx-run-foot">
                  <span>{branch.node_count || 0} {copy.nodeCount}</span>
                  <span>{branch.ending_count || 0} {copy.endingUnit}</span>
                  <ArrowUpRight aria-hidden="true" strokeWidth={1.8} />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="ct-two-grid gx-play-grid">
        <section className="ct-section gx-roleplay">
          <div className="ct-section-head">
            <div>
              <span className="ct-kicker">{copy.roleplayKicker}</span>
              <h2>{copy.roleplay}</h2>
            </div>
            <Swords aria-hidden="true" strokeWidth={1.5} />
          </div>
          <p className="gx-roleplay-desc">{copy.roleplayDesc}</p>
          <div className="gx-role-list">
            {roleCharacters.map((character) => (
              <div className="gx-role-row" key={character.id}>
                <span className="ct-avatar small">{initialOf(character.name)}</span>
                <div><strong>{character.name}</strong><span>{character.role} · {character.worldName}</span></div>
              </div>
            ))}
          </div>
          <div className="gx-play-actions">
            <button type="button" className="ct-ghost" onClick={onOpenCharacters}>{copy.selectCharacter} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} /></button>
            <button type="button" className="ct-primary" onClick={onOpenSimulation}>{copy.enterSimulation} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} /></button>
          </div>
        </section>

        <section className="ct-section gx-multiplayer">
          <div className="ct-section-head">
            <div>
              <span className="ct-kicker">{copy.multiplayerKicker}</span>
              <h2>{copy.multiplayer}</h2>
            </div>
            <Users aria-hidden="true" strokeWidth={1.5} />
          </div>
          <div className="gx-multi-empty">
            <span><Users aria-hidden="true" strokeWidth={1.4} /></span>
            <strong>{copy.multiplayerEmpty}</strong>
            <p>{copy.multiplayerHint}</p>
          </div>
          <div className="gx-publish">
            <div><Flag aria-hidden="true" strokeWidth={1.4} /><strong>{copy.publishTitle}</strong></div>
            <span>{copy.publishEmpty}</span>
            <p>{copy.publishHint}</p>
          </div>
        </section>
      </div>

      <div className="ct-bottom-grid gx-bottom-grid">
        <section className="ct-section gx-endings">
          <div className="ct-section-head">
            <div>
              <span className="ct-kicker">{copy.endingKicker}</span>
              <h2>{copy.endingGallery}</h2>
            </div>
            <Flag aria-hidden="true" strokeWidth={1.5} />
          </div>
          {endingCount === 0 ? (
            <div className="ct-empty"><Flag aria-hidden="true" strokeWidth={1.4} /><strong>{copy.noEndings}</strong></div>
          ) : (
            <div className="gx-ending-grid">
              {storyEndings.map((ending) => (
                <button type="button" className="gx-ending-card" key={ending.id} onClick={onOpenStoryline}>
                  <span className={`ct-type ${ending.is_final ? 'final' : 'open'}`}>{ending.is_final ? copy.final : copy.openEnding}</span>
                  <strong>{ending.name}</strong>
                  <p>{excerpt(ending.content, 110) || '—'}</p>
                  <span className="gx-ending-foot">{copy.unlocked} · {formatDate(story?.created_at, lang)} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} /></span>
                </button>
              ))}
              {simulationEndings.map((ending) => (
                <button type="button" className="gx-ending-card" key={ending.id} onClick={onOpenMultipath}>
                  <span className={`ct-type ${ending.allow_continue ? 'open' : 'final'}`}>{ending.allow_continue ? copy.openEnding : copy.final}</span>
                  <strong>{ending.name}</strong>
                  <p>{excerpt(ending.description, 110) || '—'}</p>
                  <span className="gx-ending-foot">{copy.unlocked} · {formatDate(ending.created_at, lang)} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} /></span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="ct-section gx-world">
          <div className="ct-section-head">
            <div>
              <span className="ct-kicker">{copy.worldKicker}</span>
              <h2>{copy.worldExplore}</h2>
            </div>
            <Map aria-hidden="true" strokeWidth={1.5} />
          </div>
          <div className="gx-world-cover">
            <Compass aria-hidden="true" strokeWidth={1.3} />
            <strong>{worldName || '—'}</strong>
            <p>{excerpt(worldDescription, 100)}</p>
          </div>
          <div className="gx-world-links">
            <button type="button" onClick={onOpenWorld}>{copy.enterWorld} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} /></button>
            <button type="button" onClick={onOpenWorldData}>{copy.worldData} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} /></button>
            <button type="button" onClick={onOpenWorldStructure}>{copy.worldStructure} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} /></button>
            <button type="button" onClick={onOpenRelationships}>{copy.relationships} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} /></button>
          </div>
        </section>
      </div>

      <div className="ct-note">{copy.note}</div>
    </div>
  )
}

function characterCount(characters: BasicCharacter[]) {
  return characters.length
}
