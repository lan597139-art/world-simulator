import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
// @ts-ignore
import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';
import '../styles/product-workspace.css';

const API = 'http://127.0.0.1:8000/api';

const EMPTY_FORM = {
  source_id: '', target_id: '', relation_type: '', description: '',
  is_bidirectional: false,
  source_quadrant: '漠视', source_strength: '中', source_power: '对等', source_value: '利己',
  target_quadrant: '漠视', target_strength: '中', target_power: '对等', target_value: '利己',
  status: 'active', valid_from: '', valid_until: '',
};

const toLocalInput = (value?: string | null) =>
  value ? String(value).replace(' ', 'T').slice(0, 16) : '';

const toBackendTime = (value?: string | null) =>
  value ? `${String(value).replace(' ', 'T').slice(0, 16).replace('T', ' ')}:00` : null;

/** 解析实际生效的主题：settings 里选“跟随系统”时 data-theme 是 system，不能只看属性值。 */
const resolveTheme = (): 'light' | 'dark' => {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/** 3D 画布背景跟随页面底色，避免深色模式下出现整屏惨白。 */
const graphBackground = () => {
  if (resolveTheme() === 'light') return '#fdfdfd';
  const pageBackground = getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim();
  return pageBackground || '#121212';
};

const LABEL_FONT = '700 44px -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

/**
 * 把名称直接印在球体正面：透明背景、白字 + 深色描边。
 * 不再使用“卡片 + 插在球上”的悬浮标签。
 */
const makeNodeLabelSprite = (name: string, type: string, nodeRadius: number) => {
  const text = String(name || '').trim();
  if (!text) return null;
  // 人物/组织名称更醒目，地点/资源名称稍小；聚焦放大后都能清楚读到。
  const isPrimary = type === 'character' || type === 'organization';

  const display = text.length > 10 ? `${text.slice(0, 9)}…` : text;
  const canvas = document.createElement('canvas');
  const measure = canvas.getContext('2d');
  if (!measure) return null;

  measure.font = LABEL_FONT;
  const textWidth = Math.ceil(measure.measureText(display).width);
  const paddingX = 6;
  const height = 58;
  canvas.width = Math.ceil(textWidth + paddingX * 2);
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 9;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.82)';
  ctx.strokeText(display, canvas.width / 2, canvas.height / 2 + 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(display, canvas.width / 2, canvas.height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.anisotropy = 2;

  // 字号随球体大小缩放，并限制在球体宽度内，保证文字真的“长在球上”。
  let labelHeight = nodeRadius * (isPrimary ? 1.15 : 0.95);
  let labelWidth = labelHeight * canvas.width / canvas.height;
  const maxWidth = nodeRadius * 1.9;
  if (labelWidth > maxWidth) {
    labelWidth = maxWidth;
    labelHeight = maxWidth * canvas.height / canvas.width;
  }

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    opacity: isPrimary ? 1 : 0.82,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(labelWidth, labelHeight, 1);
  sprite.renderOrder = 10;
  return sprite;
};


function ViewButton({
  onClick,
  title,
  active = false,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5px',
        minWidth: '34px',
        height: '32px',
        padding: '0 9px',
        borderRadius: '8px',
        border: `1px solid ${active ? 'var(--text-main)' : 'var(--card-border)'}`,
        background: active ? 'var(--text-main)' : 'transparent',
        color: active ? 'var(--bg-color)' : 'var(--text-main)',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

export default function RelationshipsPage({
  worldId,
  onOpenCharacter,
  onNavigate,
  mode = 'world',
}: {
  worldId?: string;
  onOpenCharacter?: (characterId: string) => void;
  onNavigate?: (page: string) => void;
  mode?: string;
}) {
  const simpleRelations = mode !== 'world';
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [characters, setCharacters] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [allEntities, setAllEntities] = useState<any[]>([]);
  const [allRelationships, setAllRelationships] = useState<any[]>([]);
  const [filters, setFilters] = useState({ scope: 'all', status: 'active', relationType: 'all' });
  const [query, setQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingHistory, setEditingHistory] = useState<any[]>([]);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  // 自动旋转 / 自定义转速
  const [autoRotate, setAutoRotate] = useState(false);
  const [rotateSpeed, setRotateSpeed] = useState(1);
  const autoRotateRef = useRef(false);
  const rotateSpeedRef = useRef(1);
  const suppressRotateUntil = useRef(0);

  // 3D 图表引用
  const graphRef = useRef<HTMLDivElement>(null);
  const graphInstance = useRef<any>(null);

  const loadData = async () => {
    try {
      const qs = worldId ? `?world_id=${worldId}` : '';
      const [charRes, orgRes, locRes, relRes, resRes] = await Promise.all([
        fetch(`http://127.0.0.1:8000/api/characters${qs}`),
        fetch(`http://127.0.0.1:8000/api/organizations${qs}`),
        fetch(`http://127.0.0.1:8000/api/locations${qs}`),
        fetch(`http://127.0.0.1:8000/api/relationships${qs}`),
        worldId ? fetch(`http://127.0.0.1:8000/api/worlds/${worldId}/resources`) : Promise.resolve(null),
      ]);
      const [charData, orgData, locData, relData, resDataRaw] = await Promise.all([
        charRes.json(), orgRes.json(), locRes.json(), relRes.json(), resRes ? resRes.json() : [],
      ]);
      const resData = resDataRaw || [];
      setCharacters(charData);
      setOrganizations(orgData);
      setLocations(locData);
      setResources(resData);
      setAllRelationships(relData);

      const allEnts = [
        ...charData.map((c: any) => ({ id: String(c.id), name: c.name, type: 'character' })),
        ...orgData.map((o: any) => ({ id: String(o.id), name: o.name, type: 'organization' })),
        ...locData.map((l: any) => ({ id: String(l.id), name: l.name, type: 'location' })),
        ...resData.map((r: any) => ({ id: String(r.id), name: r.name, type: 'resource' })),
      ];
      setAllEntities(allEnts);
    } catch (error) {
      console.error("加载数据失败", error);
    }
  };

  // 计算当前可见的 3D 数据
  const graphData = useMemo(() => {
    if (allEntities.length === 0) return { nodes: [], links: [] };

    const known = new Set(allEntities.map((entity: any) => entity.id));
    const entityById = new Map(allEntities.map((entity: any) => [entity.id, entity]));
    const typeOf = (id: string) => entityById.get(id)?.type;
    const nameOf = (id: string) => entityById.get(id)?.name || '';
    const keyword = query.trim().toLowerCase();

    // 1. 筛选连线
    const visibleLinks = allRelationships.filter((rel: any) => {
      if (!known.has(String(rel.source_id)) || !known.has(String(rel.target_id))) return false;
      if (filters.status === 'active' && rel.status === 'ended') return false;
      if (filters.status === 'ended' && rel.status !== 'ended') return false;
      if (filters.relationType !== 'all' && rel.relation_type !== filters.relationType) return false;
      if (keyword) {
        const haystack = `${rel.relation_type || ''} ${rel.description || ''} ${nameOf(String(rel.source_id))} ${nameOf(String(rel.target_id))}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      if (filters.scope !== 'all') {
        const sourceType = rel.source_type || typeOf(String(rel.source_id));
        const targetType = rel.target_type || typeOf(String(rel.target_id));
        const types = [sourceType, targetType];
        if (filters.scope === 'character' && !types.every((t) => t === 'character')) return false;
        if (filters.scope !== 'character' && !types.includes(filters.scope)) return false;
      }
      return true;
    });

    // 2. 计算节点度数
    const degreeMap: Record<string, number> = {};
    visibleLinks.forEach((rel: any) => {
      degreeMap[String(rel.source_id)] = (degreeMap[String(rel.source_id)] || 0) + 1;
      degreeMap[String(rel.target_id)] = (degreeMap[String(rel.target_id)] || 0) + 1;
    });

    // 3. 生成 3D 节点（强制 ID 为 String 类型）
    const nodes = allEntities.map((e: any) => {
      const degree = degreeMap[e.id] || 0;
      const isCore = degree > 2;
      
      let color = '#4f7cff'; 
      if (e.type === 'organization') color = '#8b5cf6'; 
      if (e.type === 'location') color = '#a1a1aa'; 
      if (e.type === 'resource') color = '#d97706'; 

      if (degree === 0) color = 'rgba(100,100,100,0.2)';

      return {
        id: String(e.id), // 必须为 String
        name: e.name,
        type: e.type,
        degree,
        val: isCore ? 20 + degree * 5 : 8 + degree * 2,
        color: degree === 0 ? '#6b6b75' : color,
        opacity: degree === 0 ? 0.55 : 1
      };
    });

    // 4. 生成 3D 连线（强制 Source/Target 为 String 类型）
    const links = visibleLinks.map((rel: any) => {
      let color = 'rgba(150,150,150,0.4)';
      if (rel.source_quadrant === '亲密') color = 'rgba(16, 185, 129, 0.6)'; 
      if (rel.source_quadrant === '认同') color = 'rgba(59, 130, 246, 0.6)'; 
      if (rel.source_quadrant === '敌对') color = 'rgba(239, 68, 68, 0.6)'; 

      const ended = rel.status === 'ended';
      return {
        source: String(rel.source_id), // 必须为 String
        target: String(rel.target_id), // 必须为 String
        label: rel.relation_type,
        color: ended ? 'rgba(150,150,150,0.1)' : color,
        directed: rel.is_bidirectional, 
        width: rel.source_strength === '强' ? 2 : 0.5,
        data: rel 
      };
    });

    return { nodes, links };
  }, [allEntities, allRelationships, filters, query]);

  const handleLinkClick = useCallback((link: any) => {
    const rel = link.data;
    if (!rel) return;
    
    setFormData({
      source_id: rel.source_id,
      target_id: rel.target_id,
      relation_type: rel.relation_type || '',
      description: rel.description || '',
      is_bidirectional: rel.is_bidirectional || false,
      source_quadrant: rel.source_quadrant || '漠视',
      source_strength: rel.source_strength || '中',
      source_power: rel.source_power || '对等',
      source_value: rel.source_value || '利己',
      target_quadrant: rel.target_quadrant || '漠视',
      target_strength: rel.target_strength || '中',
      target_power: rel.target_power || '对等',
      target_value: rel.target_value || '利己',
      status: rel.status || 'active',
      valid_from: toLocalInput(rel.valid_from),
      valid_until: toLocalInput(rel.valid_until),
    });
    setEditingHistory(rel.history || []); 
    setEditingId(rel.id);
    setIsModalOpen(true);
  }, []);

  // 点击节点：把节点放到画面中心，并保持“适中”的球体屏幕尺寸，避免变成巨无霸。
  const focusNode = useCallback((node: any) => {
    const graph = graphInstance.current;
    if (!graph) return;

    const target = new THREE.Vector3(Number(node.x) || 0, Number(node.y) || 0, Number(node.z) || 0);
    const camera = graph.camera() as any;
    const direction = new THREE.Vector3().subVectors(camera.position, target);
    if (direction.lengthSq() < 1e-4) direction.set(0, 0, 1);

    // 根据球体半径、视口高度和 FOV 反推距离：让球体直径约 60px，保留周边关系。
    const radius = Math.cbrt(Number(node.val) || 1) * 4;
    const viewportHeight = graphRef.current?.clientHeight || 780;
    const fov = THREE.MathUtils.degToRad(camera.fov || 45);
    const targetDiameter = 60;
    const distance = THREE.MathUtils.clamp(
      radius * viewportHeight / (targetDiameter * Math.tan(fov / 2)),
      220,
      900,
    );
    direction.normalize().multiplyScalar(distance);

    suppressRotateUntil.current = performance.now() + 1000;
    graph.cameraPosition(
      { x: target.x + direction.x, y: target.y + direction.y, z: target.z + direction.z },
      target,
      900,
    );
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const graph = graphInstance.current;
    if (!graph) return;
    const camera = graph.camera();
    const controls = graph.controls() as any;
    const target = controls?.target ? controls.target.clone() : new THREE.Vector3(0, 0, 0);
    const offset = new THREE.Vector3().subVectors(camera.position, target);
    if (offset.lengthSq() < 1) return;
    offset.multiplyScalar(factor);
    const distance = offset.length();
    if (distance < 35 || distance > 1800) return;

    suppressRotateUntil.current = performance.now() + 400;
    graph.cameraPosition(
      { x: target.x + offset.x, y: target.y + offset.y, z: target.z + offset.z },
      target,
      260,
    );
  }, []);

  const resetView = useCallback(() => {
    const graph = graphInstance.current;
    if (!graph) return;
    suppressRotateUntil.current = performance.now() + 900;
    graph.zoomToFit(700, 60);
  }, []);

  const toggleAutoRotate = useCallback(() => {
    setAutoRotate((prev) => {
      autoRotateRef.current = !prev;
      return !prev;
    });
  }, []);

  const cycleRotateSpeed = useCallback(() => {
    setRotateSpeed((prev) => (prev === 0.5 ? 1 : prev === 1 ? 1.8 : 0.5));
  }, []);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    rotateSpeedRef.current = rotateSpeed;
  }, [rotateSpeed]);

  // 自定义自动旋转：TrackballControls 原生没有 autoRotate，这里直接绕 Y 轴旋转镜头。
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.08);
      last = now;

      const graph = graphInstance.current;
      if (graph && autoRotateRef.current && now > suppressRotateUntil.current) {
        const camera = graph.camera();
        const controls = graph.controls() as any;
        const target = controls?.target ? controls.target.clone() : new THREE.Vector3(0, 0, 0);
        const offset = new THREE.Vector3().subVectors(camera.position, target);
        if (offset.lengthSq() > 1) {
          offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.3 * rotateSpeedRef.current);
          camera.position.set(target.x + offset.x, target.y + offset.y, target.z + offset.z);
          camera.lookAt(target);
          controls?.update?.();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 阻止在 3D 画布上缩放时把整个网页一起放大（触控板捏合会触发浏览器页面缩放）。
  useEffect(() => {
    const el = graphRef.current;
    if (!el) return;
    const stopWheel = (event: WheelEvent) => event.preventDefault();
    const stopGesture = (event: Event) => event.preventDefault();
    el.addEventListener('wheel', stopWheel, { passive: false });
    el.addEventListener('gesturestart', stopGesture as EventListener);
    el.addEventListener('gesturechange', stopGesture as EventListener);
    return () => {
      el.removeEventListener('wheel', stopWheel);
      el.removeEventListener('gesturestart', stopGesture as EventListener);
      el.removeEventListener('gesturechange', stopGesture as EventListener);
    };
  }, []);

  // 初始化 3D 图表
  useEffect(() => {
    if (!graphRef.current) return;

    if (graphInstance.current) {
      (graphInstance.current as any)._destructor();
      graphInstance.current = null;
    }

    const Graph = (ForceGraph3D as any)()(graphRef.current)
      .backgroundColor(graphBackground())
      .nodeColor('color')
      .nodeVal('val')
      .nodeRelSize(4)
      .nodeOpacity(1) // 不透明
      .nodeResolution(16) // 更圆
      .nodeThreeObjectExtend(true)
      .nodeThreeObject((node: any) => {
        const nodeRadius = Math.cbrt(Number(node.val) || 1) * 4;
        const sprite = makeNodeLabelSprite(node.name, node.type, nodeRadius);
        if (!sprite) return null;
        // 名称居中贴在球体正面，不再作为卡片挂在球体上方/下方。
        sprite.position.set(0, 0, 0);
        return sprite;
      })
      .onNodeClick((node: any) => focusNode(node))
      .linkColor('color')
      .linkWidth('width')
      .linkOpacity(0.8)
      .linkDirectionalArrowLength((link: any) => link.directed ? 3.5 : 0)
      .linkDirectionalArrowRelPos(1)
      .linkLabel('label')
      .onLinkClick((link: any) => {
        handleLinkClick(link);
      });

    // 保留手动拖拽旋转；自动旋转由下面的自定义动画循环控制。
    const controls = Graph.controls() as any;
    if (controls) {
      controls.staticMoving = false;
      controls.dynamicDampingFactor = 0.12;
    }

    graphInstance.current = Graph;

    // 系统主题切换或设置中心改主题时，实时同步画布底色，无需重建整个 3D 图。
    const syncBackground = () => {
      if (graphInstance.current) graphInstance.current.backgroundColor(graphBackground());
    };
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener?.('change', syncBackground);
    const themeObserver = new MutationObserver(syncBackground);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const handleResize = () => {
      if (graphRef.current) {
        Graph.width(graphRef.current.clientWidth).height(graphRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      media.removeEventListener?.('change', syncBackground);
      themeObserver.disconnect();
      if (graphInstance.current === Graph) {
        (graphInstance.current as any)._destructor();
        graphInstance.current = null;
      }
    };
  }, [handleLinkClick, focusNode]);

  // 数据更新时，注入数据并强制缩放居中
  useEffect(() => {
    const graph = graphInstance.current;
    if (!graph) return;

    graph.graphData(graphData);

    // 延迟 500ms 等节点物理散开一点后，自动缩放并居中
    const timer = window.setTimeout(() => {
      if (graphInstance.current === graph) {
        graph.zoomToFit(800, 50);
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [graphData]);

  useEffect(() => {
    loadData();
    setFormData({ ...EMPTY_FORM });
    setEditingHistory([]); 
    setIsModalOpen(false);
    setEditingId(null);
  }, [worldId]);

  const entityType = (id: string) =>
    characters.some((c) => String(c.id) === id) ? 'character'
    : organizations.some((o) => String(o.id) === id) ? 'organization'
    : locations.some((l) => String(l.id) === id) ? 'location'
    : resources.some((r) => String(r.id) === id) ? 'resource' : 'character';

  const handleSave = async () => {
    if (!formData.source_id || !formData.target_id) return alert("请选择起点和终点人物");
    try {
      const url = editingId ? `${API}/relationships/${editingId}` : `${API}/relationships`;
      const method = editingId ? 'PUT' : 'POST';
      const payload: Record<string, unknown> = {
        ...formData,
        world_id: worldId || "",
        source_type: entityType(formData.source_id),
        target_type: entityType(formData.target_id),
        valid_from: toBackendTime(formData.valid_from),
        valid_until: toBackendTime(formData.valid_until),
      };
      if (!payload.valid_from) delete payload.valid_from;
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        setIsModalOpen(false);
        setEditingId(null);
        setEditingHistory([]);
        loadData(); 
      } else {
        const errData = await res.json();
        alert(`保存失败！错误信息：${JSON.stringify(errData.detail || errData)}`);
      }
    } catch (error) {
      console.error("保存失败", error);
      alert("网络请求失败，请检查后端是否启动");
    }
  };

  const endRelationship = async () => {
    if (!editingId) return;
    if (!confirm('结束这条关系？关系记录会保留，可随时查看变迁史。')) return;
    try {
      const res = await fetch(`${API}/relationships/${editingId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('结束关系失败');
      setIsModalOpen(false);
      setEditingId(null);
      setEditingHistory([]);
      loadData();
    } catch (error: any) {
      alert(String(error.message || error));
    }
  };

  const uniqueRelationTypes = Array.from(new Set(allRelationships.map((rel: any) => rel.relation_type).filter(Boolean))) as string[];

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 120px)', minHeight: '320px', overflow: 'hidden', background: 'var(--bg-color)' }}>
      
      {/* 🎯 3D 宇宙星球容器 */}
      <div ref={graphRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} />

      {/* ================= 左上角悬浮操作面板 ================= */}
      <div style={{
        position: 'absolute', top: '20px', left: '20px', zIndex: 10, width: '300px',
        transition: 'all 0.3s ease',
        transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-320px)',
        opacity: isSidebarOpen ? 1 : 0,
        pointerEvents: isSidebarOpen ? 'auto' : 'none',
      }}>
        <div className="glass-card" style={{ 
          background: 'var(--card-bg, rgba(255, 255, 255, 0.85))', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '16px', border: '1px solid var(--card-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--card-border)' }}>
            <button
              style={{ width: '100%', padding: '10px', background: 'var(--text-main)', color: 'var(--bg-color)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => { setEditingId(null); setEditingHistory([]); setFormData({ ...EMPTY_FORM }); setIsModalOpen(true); }}
            >
              ＋ 创建关系线
            </button>
          </div>

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
            <label style={{ display: 'flex', alignItems: 'center', background: 'rgba(128,128,128,0.08)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
              <Search size={14} strokeWidth={1.8} style={{ marginRight: '8px', opacity: 0.5, color: 'var(--text-main)' }} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索人物、组织或关系类型" style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', color: 'var(--text-main)', fontSize: '13px' }} />
            </label>

            {!simpleRelations && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>范围</span>
                <select value={filters.scope} onChange={(event) => setFilters({ ...filters, scope: event.target.value })} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '13px' }}>
                  <option value="all">全部</option>
                  <option value="character">人物之间</option>
                  <option value="organization">涉及组织</option>
                  <option value="location">涉及地点</option>
                  <option value="resource">涉及资源</option>
                </select>
              </label>
            )}

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>状态</span>
              <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '13px' }}>
                <option value="active">进行中</option>
                <option value="ended">已结束</option>
                <option value="all">全部</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>类型</span>
              <select value={filters.relationType} onChange={(event) => setFilters({ ...filters, relationType: event.target.value })} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '13px' }}>
                <option value="all">全部类型</option>
                {uniqueRelationTypes.map((name: string) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <button onClick={() => { setQuery(''); setFilters({ scope: 'all', status: 'active', relationType: 'all' }); }} style={{ padding: '6px 12px', background: 'rgba(128,128,128,0.1)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-main)', fontSize: '12px' }}>重置</button>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{graphData.links.length} / {allRelationships.length} 条关系</span>
            </div>
          </div>
        </div>
      </div>

      {/* 展开收起按钮 */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        style={{ position: 'absolute', top: '20px', left: isSidebarOpen ? '330px' : '20px', zIndex: 20, width: '32px', height: '32px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', color: 'var(--text-main)', transition: 'all 0.3s ease' }}
      >
        {isSidebarOpen ? '◀' : '▶'}
      </button>

      {/* 视图控制条：放大 / 缩小 / 自动旋转 / 转速 / 重置 */}
      <div
        className="ws-glass-surface"
        style={{
          position: 'absolute',
          right: '20px',
          bottom: '20px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px',
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: '12px',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
        }}
      >
        <ViewButton onClick={() => zoomBy(0.78)} title="放大视图">＋</ViewButton>
        <ViewButton onClick={() => zoomBy(1.28)} title="缩小视图">－</ViewButton>
        <span style={{ width: '1px', height: '20px', background: 'var(--card-border)' }} />
        <ViewButton onClick={toggleAutoRotate} title={autoRotate ? '暂停自动旋转' : '开启自动旋转'} active={autoRotate}>
          {autoRotate ? '⏸ 暂停' : '▶ 自动旋转'}
        </ViewButton>
        <ViewButton onClick={cycleRotateSpeed} title="切换自动旋转速度">转速 {rotateSpeed}×</ViewButton>
        <span style={{ width: '1px', height: '20px', background: 'var(--card-border)' }} />
        <ViewButton onClick={resetView} title="回到全局视图">⟲ 重置</ViewButton>
      </div>

      {/* ================= 弹窗面板 ================= */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '700px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-color)', padding: '24px', borderRadius: '16px', border: '1px solid var(--card-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: '0 0 20px 0', color: 'var(--text-main)' }}>{editingId ? '编辑关系线' : '创建关系线'}</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>起点对象 (A)</label>
                <select value={formData.source_id} onChange={e => setFormData({...formData, source_id: e.target.value})} disabled={!!editingId} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)' }}>
                  <option value="">选择对象</option>
                  <optgroup label="人物">{characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                  {!simpleRelations && <>
                    <optgroup label="组织">{organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</optgroup>
                    <optgroup label="地点">{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</optgroup>
                    <optgroup label="资源">{resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</optgroup>
                  </>}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>终点对象 (B)</label>
                <select value={formData.target_id} onChange={e => setFormData({...formData, target_id: e.target.value})} disabled={!!editingId} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)' }}>
                  <option value="">选择对象</option>
                  <optgroup label="人物">{characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                  {!simpleRelations && <>
                    <optgroup label="组织">{organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</optgroup>
                    <optgroup label="地点">{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</optgroup>
                    <optgroup label="资源">{resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</optgroup>
                  </>}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>关系类型</label>
                <input type="text" value={formData.relation_type} onChange={e => setFormData({...formData, relation_type: e.target.value})} placeholder="如：恋人、主仆" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>方向性</label>
                <select value={String(formData.is_bidirectional)} onChange={e => setFormData({...formData, is_bidirectional: e.target.value === 'true'})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)' }}>
                  <option value="false">单向 (A → B)</option>
                  <option value="true">双向 (A ⇄ B)</option>
                </select>
              </div>
            </div>

            <div style={{ borderTop: '1px dashed var(--card-border)', paddingTop: '16px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '12px' }}>A 对 B 的认知</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                <select value={formData.source_quadrant} onChange={e => setFormData({...formData, source_quadrant: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)' }}>
                  {['亲密', '认同', '敌对', '漠视'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select value={formData.source_strength} onChange={e => setFormData({...formData, source_strength: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)' }}>
                  {['强', '中', '弱'].map(o => <option key={o} value={o}>强度: {o}</option>)}
                </select>
                <select value={formData.source_power} onChange={e => setFormData({...formData, source_power: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)' }}>
                  {['对等', '不对等'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select value={formData.source_value} onChange={e => setFormData({...formData, source_value: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)' }}>
                  {['利他', '利己'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            {formData.is_bidirectional && (
              <div style={{ borderTop: '1px dashed var(--card-border)', paddingTop: '16px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '12px' }}>B 对 A 的认知</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                  <select value={formData.target_quadrant} onChange={e => setFormData({...formData, target_quadrant: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)' }}>
                    {['亲密', '认同', '敌对', '漠视'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select value={formData.target_strength} onChange={e => setFormData({...formData, target_strength: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)' }}>
                    {['强', '中', '弱'].map(o => <option key={o} value={o}>强度: {o}</option>)}
                  </select>
                  <select value={formData.target_power} onChange={e => setFormData({...formData, target_power: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)' }}>
                    {['对等', '不对等'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select value={formData.target_value} onChange={e => setFormData({...formData, target_value: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)' }}>
                    {['利他', '利己'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>关系描述</label>
              <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)' }} placeholder="补充背景..." />
            </div>

            <div style={{ marginBottom: '24px', borderTop: '1px dashed var(--card-border)', paddingTop: '16px' }}>
              <h3 style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '12px' }}>关系状态与有效期</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>当前状态</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-color)', color: 'var(--text-main)' }}
                  >
                    {[{ value: 'active', label: '进行中' }, { value: 'strained', label: '紧张' }, { value: 'interrupted', label: '中断' }, { value: 'ended', label: '已结束' }].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>生效时间</label>
                  <input type="datetime-local" value={formData.valid_from} onChange={e => setFormData({ ...formData, valid_from: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', colorScheme: 'light dark' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>结束时间</label>
                  <input type="datetime-local" value={formData.valid_until} onChange={e => setFormData({ ...formData, valid_until: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', colorScheme: 'light dark' }} />
                </div>
              </div>
            </div>

            {editingId && editingHistory.length > 0 && (
              <div style={{ marginBottom: '24px', background: 'rgba(128,128,128,0.05)', padding: '16px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                <h3 style={{ fontSize: '14px', color: 'var(--primary-color)', marginBottom: '12px' }}>📜 关系变迁史</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {editingHistory.map((h, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '2px solid var(--primary-color)', paddingLeft: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>[{h.time}] 从「{h.old_status}」变为「{h.new_status}」</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>原因：{h.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div>
                {editingId && formData.status !== 'ended' && (
                  <button onClick={endRelationship} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--danger-color, #ef4444)', borderRadius: '6px', color: 'var(--danger-color, #ef4444)', cursor: 'pointer' }}>结束关系（保留历史）</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setIsModalOpen(false)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--card-border)', borderRadius: '6px', color: 'var(--text-main)', cursor: 'pointer' }}>取消</button>
                <button onClick={handleSave} style={{ padding: '10px 24px', background: 'var(--text-main)', border: 'none', borderRadius: '6px', color: 'var(--bg-color)', cursor: 'pointer', fontWeight: 600 }}>保存关系线</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}